import db from '@adonisjs/lucid/services/db'
import ModelImageService from '#services/documents/model_image_service'
import { countTokens } from 'gpt-tokenizer'
import config from '#config/open_router'
import EmbeddingService from '#services/documents/embedding_service'
import EvidenceService, { type EvidenceRow } from '#services/documents/evidence_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import type { SourcePin } from '#services/workspaces/task_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
/** One part of the output (an outline section or a brochure page) and what to look for in the sources. */
export type SectionQuery = { key: string; label: string; query: string }
/** The chunks that were retrieved for one section, by id. */
export type SectionEvidence = { key: string; label: string; chunkIds: string[] }

type Params = {
  context: WorkspaceAccessContext
  documentId: string
  pins: SourcePin[]
  guard: () => Promise<void>
  tokenBudget?: number
  imageMode?: 'none' | 'metadata' | 'signed'
}

export default class RetrievalService {
  /** One query for the whole document: freeform output, where there are no sections to retrieve for. */
  async search({ query, ...params }: Params & { query: string }): Promise<SourceChunk[]> {
    const result = await this.retrieve({
      ...params,
      sections: [{ key: 'all', label: 'all', query }],
      perSection: 40,
      maxText: 20,
    })
    return result.chunks
  }

  /**
   * Retrieval for each section on its own query, so a page about contacts is not
   * answered with whatever best matches the brief. Sections take turns, so every
   * one gets its best chunks before any gets its next best; a chunk that suits
   * two sections is sent once and listed under both.
   */
  async searchSections({
    sections,
    perSection = 8,
    ...params
  }: Params & { sections: SectionQuery[]; perSection?: number }): Promise<{
    chunks: SourceChunk[]
    sections: SectionEvidence[]
  }> {
    return this.retrieve({
      ...params,
      sections,
      perSection,
      maxText: Math.min(40, 6 + 3 * sections.length),
    })
  }

  private async retrieve({
    context,
    documentId,
    pins,
    sections,
    guard,
    perSection,
    maxText,
    tokenBudget = 10000,
    imageMode = 'signed',
  }: Params & { sections: SectionQuery[]; perSection: number; maxText: number }) {
    const live = sections.filter((section) => section.query.trim())
    if (!live.length || !pins.length)
      return { chunks: [] as SourceChunk[], sections: [] as SectionEvidence[] }
    const evidence = new EvidenceService()
    await guard()
    await evidence.rows(context, documentId, [], pins) // Validate route/membership even for empty ranked results.
    const embedding = new EmbeddingService()
    const vectors: string[] = []
    for (const section of live)
      vectors.push(JSON.stringify(await embedding.embedQuery(section.query, guard)))
    await guard()
    const eligible = evidence.eligible(context, documentId, pins)
    // The column is width-agnostic; the cast matches the per-width partial HNSW index.
    const width = Math.trunc(config.embeddingDimensions)
    const ranked: EvidenceRow[][] = []
    for (const [index, section] of live.entries()) {
      const vector = vectors[index]
      const query = section.query
      const result = await db.rawQuery<{ rows: (EvidenceRow & { score: number })[] }>(
        `WITH eligible AS (${eligible.sql}),
      dense AS (SELECT e.id,row_number() OVER(ORDER BY ce.embedding::vector(${width}) <=> ?::vector(${width})) AS rank FROM eligible e JOIN chunk_embeddings ce ON ce.chunk_id=e.id AND ce.workspace_id=? WHERE ce.model=? AND ce.version=? AND ce.dimensions=? ORDER BY ce.embedding::vector(${width}) <=> ?::vector(${width}) LIMIT 40),
      lexical AS (SELECT e.id,row_number() OVER(ORDER BY ts_rank_cd(e.content_tsv,plainto_tsquery('english',?)) DESC) AS rank FROM eligible e WHERE e.content_tsv @@ plainto_tsquery('english',?) ORDER BY ts_rank_cd(e.content_tsv,plainto_tsquery('english',?)) DESC LIMIT 40),
      scores AS (SELECT id,SUM(1.0/(60+rank)) AS score FROM (SELECT * FROM dense UNION ALL SELECT * FROM lexical) candidates GROUP BY id)
      SELECT e.*,s.score FROM scores s JOIN eligible e ON e.id=s.id ORDER BY s.score DESC,e.id LIMIT ?`,
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
          perSection,
        ]
      )
      ranked.push(result.rows)
      await guard()
    }
    // Supplemental visual evidence is constrained by precisely the same relation and immutable pins.
    const supplemental =
      imageMode === 'none'
        ? { rows: [] }
        : await db.rawQuery<{ rows: EvidenceRow[] }>(
            `WITH eligible AS (${eligible.sql}) SELECT * FROM eligible WHERE kind='image' AND media_type LIKE 'image/%' ORDER BY chunk_index,id LIMIT 4`,
            eligible.bindings
          )
    const images = (
      imageMode === 'none'
        ? []
        : [...ranked.flat().filter((row) => row.kind === 'image'), ...supplemental.rows]
    )
      .filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index)
      .slice(0, 4)
    // Text chunks take turns across sections: every section's best, then every section's next best.
    const rows: EvidenceRow[] = []
    const taken = new Set<string>()
    const room = Math.max(0, maxText - images.length)
    for (let rank = 0; rank < perSection && rows.length < room; rank++)
      for (const list of ranked) {
        const row = list.filter((item) => item.kind !== 'image')[rank]
        if (row && !taken.has(row.id) && rows.length < room) {
          taken.add(row.id)
          rows.push(row)
        }
      }
    rows.push(...images)
    const selected: SourceChunk[] = []
    const kept = new Set<string>()
    let tokens = 0
    for (const row of rows) {
      const cost = countTokens(`${row.file_name}\n${row.content}`)
      if (tokens + cost > tokenBudget) continue
      const source = evidence.source(context, documentId, row)
      if (imageMode === 'signed' && row.kind === 'image' && row.file_key) {
        await guard()
        source.modelFileUrl = await new ModelImageService().prepare(row.file_key, guard)
      }
      selected.push(source)
      kept.add(row.id)
      tokens += cost
    }
    return {
      chunks: selected,
      sections: live.map((section, index) => ({
        key: section.key,
        label: section.label,
        chunkIds: ranked[index].filter((row) => kept.has(row.id)).map((row) => row.id),
      })),
    }
  }
}
