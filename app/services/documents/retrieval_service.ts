import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import { countTokens } from 'gpt-tokenizer'
import config from '#config/open_router'
import EmbeddingService from '#services/documents/embedding_service'
import EvidenceService, { type EvidenceRow } from '#services/documents/evidence_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import type { SourcePin } from '#services/workspaces/task_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
export default class RetrievalService {
  async search({
    context,
    documentId,
    pins,
    query,
    guard,
    tokenBudget = 10000,
  }: {
    context: WorkspaceAccessContext
    documentId: string
    pins: SourcePin[]
    query: string
    guard: () => Promise<void>
    tokenBudget?: number
  }): Promise<SourceChunk[]> {
    if (!query.trim() || !pins.length) return []
    const evidence = new EvidenceService()
    await guard()
    await evidence.rows(context, documentId, [], pins) // Validate route/membership even for empty ranked results.
    const vector = JSON.stringify(await new EmbeddingService().embedQuery(query, guard))
    await guard()
    const eligible = evidence.eligible(context, documentId, pins)
    const result = await db.rawQuery<{ rows: (EvidenceRow & { score: number })[] }>(
      `WITH eligible AS (${eligible.sql}),
      dense AS (SELECT e.id,row_number() OVER(ORDER BY ce.embedding <=> ?::vector) AS rank FROM eligible e JOIN chunk_embeddings ce ON ce.chunk_id=e.id AND ce.workspace_id=? WHERE ce.model=? AND ce.version=? AND ce.dimensions=? ORDER BY ce.embedding <=> ?::vector LIMIT 40),
      lexical AS (SELECT e.id,row_number() OVER(ORDER BY ts_rank_cd(e.content_tsv,plainto_tsquery('english',?)) DESC) AS rank FROM eligible e WHERE e.content_tsv @@ plainto_tsquery('english',?) ORDER BY ts_rank_cd(e.content_tsv,plainto_tsquery('english',?)) DESC LIMIT 40),
      scores AS (SELECT id,SUM(1.0/(60+rank)) AS score FROM (SELECT * FROM dense UNION ALL SELECT * FROM lexical) candidates GROUP BY id)
      SELECT e.*,s.score FROM scores s JOIN eligible e ON e.id=s.id ORDER BY s.score DESC,e.id LIMIT 40`,
      [
        ...eligible.bindings,
        vector,
        context.workspaceId,
        config.embeddingModel,
        config.pipelineVersion,
        config.embeddingDimensions,
        vector,
        query,
        query,
        query,
      ]
    )
    // Supplemental visual evidence is constrained by precisely the same relation and immutable pins.
    const supplemental = await db.rawQuery<{ rows: EvidenceRow[] }>(
      `WITH eligible AS (${eligible.sql}) SELECT * FROM eligible WHERE kind='image' AND media_type LIKE 'image/%' ORDER BY chunk_index,id LIMIT 4`,
      eligible.bindings
    )
    const images = [...result.rows.filter((row) => row.kind === 'image'), ...supplemental.rows]
      .filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index)
      .slice(0, 4)
    const rows = [
      ...result.rows.filter((row) => row.kind !== 'image').slice(0, 20 - images.length),
      ...images,
    ]
    const selected: SourceChunk[] = []
    let tokens = 0
    for (const row of rows) {
      const cost = countTokens(`${row.file_name}\n${row.content}`)
      if (tokens + cost > tokenBudget) continue
      const source = evidence.source(context, documentId, row)
      if (row.kind === 'image' && row.file_key) {
        await guard()
        source.modelFileUrl = await drive.use().getSignedUrl(row.file_key, { expiresIn: 120 })
      }
      selected.push(source)
      tokens += cost
    }
    return selected
  }
}
