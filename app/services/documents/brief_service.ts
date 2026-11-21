import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { Exception } from '@adonisjs/core/exceptions'
import { countTokens } from 'gpt-tokenizer'
import config from '#config/open_router'
import EmbeddingService from '#services/documents/embedding_service'
import OpenRouterService from '#services/open_router_service'
import SourceScopeService from '#services/files/source_scope_service'
import { isCurrentRun } from '#services/documents/pipeline_identity'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import AccessService, { type WorkspaceAccessContext } from '#services/workspaces/access_service'

/** Below this, every chunk of every source is sent and nothing is left out. */
const FULL_CONTEXT_TOKENS = 12_000
/** Above it, retrieval picks the passages that best cover the story, up to this much. */
const RETRIEVED_TOKENS = 8_000
const PER_FACET = 12
const MAX_FILES = 25

/**
 * What a case-study brief has to say. Each is searched on its own so the brief is built from
 * the whole story, not just the passages that sound most like the first facet.
 */
const FACETS = [
  'Who the client or organisation is: company background, industry, size, location',
  'The problem, challenge or goal that started the project and why it mattered',
  'The solution: what was designed, built or delivered, approach, technology, scope and timeline',
  'Results and impact: outcomes, metrics, numbers, savings, growth, percentages, feedback',
]

type Candidate = {
  id: string
  chunk_index: number
  content: string
  token_count: number | null
  file_id: string
  file_name: string
  page_number: number | null
  section_path: string[] | null
}

export type BriefResult = {
  brief: string
  /** `all`: every chunk fitted, so all were sent. `retrieved`: the best passages were chosen. */
  mode: 'all' | 'retrieved'
  passages: number
  sources: { fileName: string; passages: number }[]
}

export default class BriefService {
  async generate(
    context: WorkspaceAccessContext,
    input: { projectId?: string | null; fileIds?: string[]; draft?: string | null }
  ): Promise<BriefResult> {
    const projectId = input.projectId ?? null
    const project = projectId ? await new AccessService().project(context, projectId) : null
    const fileIds = await this.files(context, projectId, input.fileIds ?? [])
    if (!fileIds.length)
      throw new Exception('Choose a project with files, or add sources, before generating.', {
        status: 422,
        code: 'E_BRIEF_NO_SOURCES',
      })

    const candidates = await this.candidates(context, fileIds)
    if (!candidates.length)
      throw new Exception(
        'Your sources are still being prepared. Try again once they show as ready.',
        { status: 409, code: 'E_BRIEF_NOT_READY' }
      )

    const total = candidates.reduce((sum, chunk) => sum + this.cost(chunk), 0)
    const anchor = [project?.name, project?.description, input.draft]
      .filter(Boolean)
      .join('. ')
      .replace(/\s+/g, ' ')
      .slice(0, 400)
    const mode = total <= FULL_CONTEXT_TOKENS ? 'all' : 'retrieved'
    const chosen = mode === 'all' ? candidates : await this.retrieve(context, candidates, anchor)

    let brief: string
    try {
      brief = await new OpenRouterService().generateBrief(
        { project: project?.name ?? null, draft: input.draft?.trim() || null },
        chosen.map((chunk) => this.source(chunk))
      )
    } catch (error) {
      logger.warn({ err: error }, 'Brief generation failed')
      const status = OpenRouterService.status(error)
      throw new Exception(
        (status && config.failureMessages[status]) ||
          'The brief could not be written. Your brief is unchanged. Try again.',
        { status: status === 429 ? 429 : 502, code: 'E_BRIEF_FAILED' }
      )
    }

    const counts = new Map<string, number>()
    for (const chunk of chosen) counts.set(chunk.file_name, (counts.get(chunk.file_name) ?? 0) + 1)
    return {
      brief,
      mode,
      passages: chosen.length,
      sources: [...counts].map(([fileName, passages]) => ({ fileName, passages })),
    }
  }

  /** The selected sources plus every file of the project, all checked against the project rule. */
  private async files(context: WorkspaceAccessContext, projectId: string | null, picked: string[]) {
    const selected = [...new Set(picked)]
    await new SourceScopeService().assertSelectable(
      db.connection(),
      context.workspaceId,
      selected,
      projectId
    )
    const linked = projectId
      ? await db
          .from('project_files')
          .where({ workspace_id: context.workspaceId, project_id: projectId })
          .select('file_id')
      : []
    const ids = [...new Set([...selected, ...linked.map((row) => row.file_id as string)])]
    if (!ids.length) return []
    const owned = await db
      .from('files')
      .where('workspace_id', context.workspaceId)
      .whereIn('id', ids)
      .select('id')
    return owned.map((row) => row.id as string).slice(0, MAX_FILES)
  }

  /** Text chunks from each file's latest revision, only where its run is ready and current. */
  private async candidates(context: WorkspaceAccessContext, fileIds: string[]) {
    const runs = await db.rawQuery<{
      rows: {
        run_id: string | null
        status: string | null
        pipeline_version: string
        embedding_model: string | null
        embedding_dimensions: number | null
        contextualizer: string | null
      }[]
    }>(
      `SELECT DISTINCT ON (f.id) pr.id AS run_id,pr.status,pr.pipeline_version,pr.embedding_model,pr.embedding_dimensions,pr.contextualizer
       FROM files f
       JOIN file_revisions fr ON fr.file_id=f.id AND fr.workspace_id=f.workspace_id
       LEFT JOIN processing_runs pr ON pr.file_revision_id=fr.id AND pr.workspace_id=fr.workspace_id
       WHERE f.workspace_id=? AND f.id=ANY(?::uuid[])
       ORDER BY f.id,fr.revision DESC,pr.created_at DESC NULLS LAST`,
      [context.workspaceId, fileIds]
    )
    const ready = runs.rows
      .filter((run) => run.run_id && run.status === 'ready')
      .filter((run) =>
        isCurrentRun({
          pipelineVersion: run.pipeline_version,
          embeddingModel: run.embedding_model,
          embeddingDimensions: run.embedding_dimensions,
          contextualizer: run.contextualizer,
        })
      )
      .map((run) => run.run_id!)
    if (!ready.length) return []
    const result = await db.rawQuery<{ rows: Candidate[] }>(
      `SELECT DISTINCT ON (c.id) c.id,c.chunk_index,c.content,c.token_count,f.id AS file_id,f.filename AS file_name,
         NULLIF(b.source_locator->>'pageNumber','')::integer AS page_number,b.section_path
       FROM chunks c
       JOIN files f ON f.id=c.file_id AND f.workspace_id=c.workspace_id
       LEFT JOIN chunk_blocks cb ON cb.chunk_id=c.id AND cb.workspace_id=c.workspace_id AND cb.run_id=c.run_id
       LEFT JOIN document_blocks b ON b.id=cb.document_block_id AND b.workspace_id=cb.workspace_id AND b.processing_run_id=cb.run_id
       WHERE c.workspace_id=? AND c.run_id=ANY(?::uuid[]) AND c.kind='text' AND NOT c.tenancy_quarantined
         AND coalesce(btrim(c.content),'')<>''
       ORDER BY c.id,b.order_index`,
      [context.workspaceId, ready]
    )
    return this.ordered(result.rows)
  }

  /**
   * Hybrid retrieval, one search per facet: dense (embedding distance) and lexical (full text)
   * rankings fused with reciprocal rank fusion. Facets then take turns so every part of the
   * story is covered, each file's opening passage is kept for context, and no file may crowd
   * out the others.
   */
  private async retrieve(context: WorkspaceAccessContext, candidates: Candidate[], anchor: string) {
    const ids = candidates.map((chunk) => chunk.id)
    const byId = new Map(candidates.map((chunk) => [chunk.id, chunk]))
    const queries = FACETS.map((facet) => (anchor ? `${facet}\n${anchor}` : facet))
    const embedding = new EmbeddingService()
    const vectors = await Promise.all(
      queries.map(async (query) => JSON.stringify(await embedding.embedQuery(query)))
    )
    const width = Math.trunc(config.embeddingDimensions)
    const ranked: string[][] = []
    for (const [index, query] of queries.entries()) {
      const terms = this.terms(query)
      const result = await db.rawQuery<{ rows: { id: string }[] }>(
        `WITH eligible AS (SELECT unnest(?::uuid[]) AS id),
         dense AS (
           SELECT ce.chunk_id AS id,row_number() OVER (ORDER BY ce.embedding::vector(${width}) <=> ?::vector(${width})) AS rank
           FROM chunk_embeddings ce JOIN eligible e ON e.id=ce.chunk_id
           WHERE ce.workspace_id=? AND ce.model=? AND ce.version=? AND ce.dimensions=?
           ORDER BY ce.embedding::vector(${width}) <=> ?::vector(${width}) LIMIT 40),
         lexical AS (
           SELECT c.id,row_number() OVER (ORDER BY ts_rank_cd(c.content_tsv,q) DESC) AS rank
           FROM chunks c JOIN eligible e ON e.id=c.id, to_tsquery('english',?) q
           WHERE ?::boolean AND c.workspace_id=? AND c.content_tsv @@ q
           ORDER BY ts_rank_cd(c.content_tsv,q) DESC LIMIT 40)
         SELECT id FROM (SELECT * FROM dense UNION ALL SELECT * FROM lexical) hits
         GROUP BY id ORDER BY SUM(1.0/(60+rank)) DESC,id LIMIT ?`,
        [
          ids,
          vectors[index],
          context.workspaceId,
          config.embeddingModel,
          config.pipelineVersion,
          config.embeddingDimensions,
          vectors[index],
          terms || 'none',
          !!terms,
          context.workspaceId,
          PER_FACET,
        ]
      )
      ranked.push(result.rows.map((row) => row.id))
    }

    const files = new Set(candidates.map((chunk) => chunk.file_id))
    const perFile = Math.max(3, Math.ceil((PER_FACET * FACETS.length) / files.size / 1.5))
    const chosen: Candidate[] = []
    const taken = new Set<string>()
    const share = new Map<string, number>()
    let tokens = 0
    const take = (chunk: Candidate | undefined, capped: boolean) => {
      if (!chunk || taken.has(chunk.id)) return
      if (capped && (share.get(chunk.file_id) ?? 0) >= perFile) return
      const cost = this.cost(chunk)
      if (tokens + cost > RETRIEVED_TOKENS) return
      taken.add(chunk.id)
      share.set(chunk.file_id, (share.get(chunk.file_id) ?? 0) + 1)
      chosen.push(chunk)
      tokens += cost
    }
    // The opening passage of each file usually names the client and the project.
    for (const file of files)
      take(
        candidates.find((chunk) => chunk.file_id === file),
        false
      )
    for (let rank = 0; rank < PER_FACET; rank++)
      for (const list of ranked) take(byId.get(list[rank]), true)
    return this.ordered(chosen)
  }

  /** Content words of a query as an OR full-text query, so long facet queries still match. */
  private terms(query: string) {
    const words = query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
    return [...new Set(words)].slice(0, 30).join(' | ')
  }

  private cost(chunk: Candidate) {
    return chunk.token_count || countTokens(chunk.content)
  }

  /** Reading order: file by file, then as the chunks appear in the file. */
  private ordered(chunks: Candidate[]) {
    return [...chunks].sort(
      (a, b) =>
        a.file_name.localeCompare(b.file_name) ||
        a.file_id.localeCompare(b.file_id) ||
        Number(a.chunk_index) - Number(b.chunk_index)
    )
  }

  private source(chunk: Candidate): SourceChunk {
    return {
      id: chunk.id,
      chunkIndex: Number(chunk.chunk_index),
      content: chunk.content,
      fileName: chunk.file_name,
      fileUrl: '',
      mediaType: null,
      pageNumber: chunk.page_number === null ? null : Number(chunk.page_number),
      section: chunk.section_path?.length ? chunk.section_path.join(' > ') : null,
    }
  }
}
