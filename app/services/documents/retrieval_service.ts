import db from '@adonisjs/lucid/services/db'
import ModelImageService from '#services/documents/model_image_service'
import { countTokens } from 'gpt-tokenizer'
import config from '#config/open_router'
import EmbeddingService from '#services/documents/embedding_service'
import EvidenceService, { type EvidenceRow } from '#services/documents/evidence_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import type { SourcePin } from '#services/workspaces/task_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import { fuse, type PageQuery } from '#services/canvas/generation/page_queries'
import { dedupeChunks } from '../../../shared/canvas/copy_rules.ts'
/** One part of the output (an outline section or a brochure page) and what to look for in the sources. */
export type SectionQuery = { key: string; label: string; query: string }
/** The chunks that were retrieved for one section, by id. */
export type SectionEvidence = { key: string; label: string; chunkIds: string[] }

/** What was retrieved for one page of a canvas document. */
export type PageEvidence = {
  key: string
  /** Text chunks the page's first write reads, best first. */
  chunks: SourceChunk[]
  /** The next best text chunks, given only when the page has to be expanded. */
  extra: SourceChunk[]
  /** Image chunks that matched, for the image planner. */
  images: ImageEvidence[]
}
export type ImageEvidence = {
  chunk: SourceChunk
  fileId: string
  fileKey: string | null
  /** Fused retrieval score, 0 to 1 within the page. */
  score: number
}

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
  async search({
    query,
    maxText = 20,
    ...params
  }: Params & { query: string; maxText?: number }): Promise<SourceChunk[]> {
    const result = await this.retrieve({
      ...params,
      sections: [{ key: 'all', label: 'all', query }],
      perSection: Math.max(40, maxText),
      maxText,
    })
    return result.chunks
  }

  /**
   * Retrieval for each page of a canvas document, on its own budget. A page has
   * several queries (its subject and each research question); their results are
   * fused. Pages are served in order, and a chunk an earlier page took counts for
   * half on later ones, so each page reaches for new evidence. Each page keeps up
   * to `maxText` text chunks within `tokenBudget`, plus `extra` more for an
   * expansion, and up to `imageLimit` image chunks.
   */
  async searchPages({
    context,
    documentId,
    pins,
    guard,
    pages,
    tokenBudget = 3500,
    perQuery = 12,
    maxText = 10,
    extra = 4,
    imageLimit = 3,
  }: Omit<Params, 'imageMode' | 'tokenBudget'> & {
    pages: PageQuery[]
    tokenBudget?: number
    perQuery?: number
    maxText?: number
    extra?: number
    imageLimit?: number
  }): Promise<PageEvidence[]> {
    if (!pins.length || !pages.length)
      return pages.map((page) => ({ key: page.key, chunks: [], extra: [], images: [] }))
    const evidence = new EvidenceService()
    await guard()
    await evidence.rows(context, documentId, [], pins) // Validates route and membership.
    const embedding = new EmbeddingService()
    const eligible = evidence.eligible(context, documentId, pins)
    const width = Math.trunc(config.embeddingDimensions)
    const vectors = new Map<string, string>()
    const used = new Set<string>()
    const out: PageEvidence[] = []
    for (const page of pages) {
      const lists: EvidenceRow[][] = []
      for (const query of page.queries.filter((q) => q.trim())) {
        if (!vectors.has(query))
          vectors.set(query, JSON.stringify(await embedding.embedQuery(query, guard)))
        lists.push(await this.rank(context, eligible, vectors.get(query)!, query, perQuery, width))
        await guard()
      }
      const rows = new Map(lists.flat().map((row) => [row.id, row]))
      const fused = fuse(lists, used)
      const top = fused[0]?.score ?? 1
      const text: EvidenceRow[] = []
      const more: EvidenceRow[] = []
      const images: ImageEvidence[] = []
      let tokens = 0
      // Near-identical text chunks (the same passage in two files) are sent once.
      const distinct = new Set(
        dedupeChunks(
          fused.map(({ id }) => rows.get(id)!).filter((row) => row.kind !== 'image')
        ).map((row) => row.id)
      )
      for (const { id, score } of fused) {
        const row = rows.get(id)!
        if (row.kind !== 'image' && !distinct.has(id)) continue
        if (row.kind === 'image') {
          if (images.length < imageLimit)
            images.push({
              chunk: evidence.source(context, documentId, row),
              fileId: row.file_id,
              fileKey: row.file_key,
              score: Number((score / top).toFixed(3)),
            })
          continue
        }
        const cost = countTokens(`${row.file_name}\n${row.content}`)
        if (text.length < maxText && tokens + cost <= tokenBudget) {
          text.push(row)
          tokens += cost
        } else if (more.length < extra && tokens + cost <= tokenBudget * 1.5) {
          more.push(row)
          tokens += cost
        }
      }
      for (const row of text) used.add(row.id)
      out.push({
        key: page.key,
        chunks: text.map((row) => evidence.source(context, documentId, row)),
        extra: more.map((row) => evidence.source(context, documentId, row)),
        images,
      })
    }
    return out
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

  /** One query's best chunks: dense and lexical lists fused by reciprocal rank. */
  private async rank(
    context: WorkspaceAccessContext,
    eligible: ReturnType<EvidenceService['eligible']>,
    vector: string,
    query: string,
    limit: number,
    width: number
  ) {
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
        limit,
      ]
    )
    return result.rows
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
      const rows = await this.rank(context, eligible, vector, section.query, perSection, width)
      ranked.push(rows)
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
