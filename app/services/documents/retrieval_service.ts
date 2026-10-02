import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import { countTokens } from 'gpt-tokenizer'

import openRouterApiConfig from '#config/open_router'
import EmbeddingService from '#services/documents/embedding_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'

type SearchRow = {
  id: string
  chunk_index: number | string
  content: string
  file_name: string
  file_key: string | null
  file_url: string | null
  media_type: string | null
  page_number: number | string | null
  score: number | string
  kind: 'text' | 'image'
}

const DENSE_CANDIDATES = 40
const LEXICAL_CANDIDATES = 40
const CONTEXT_TOKEN_BUDGET = 10_000
const RRF_CONSTANT = 60
const MAX_SOURCE_IMAGES = 4
const MAX_CONTEXT_CHUNKS = 20
const MAX_CHUNK_TOKENS = 600

export default class RetrievalService {
  private readonly embeddings = new EmbeddingService()

  async search({
    query,
    fileIds,
    ownerId,
    tokenBudget = CONTEXT_TOKEN_BUDGET,
  }: {
    query: string
    fileIds: string[]
    ownerId: number
    tokenBudget?: number
  }): Promise<SourceChunk[]> {
    if (!query.trim() || fileIds.length === 0) return []

    const queryVector = JSON.stringify(await this.embeddings.embedQuery(query))
    const transaction = await db.transaction()
    let result: { rows: SearchRow[] }

    try {
      // Keep baseline retrieval exact until scoped HNSW recall is measured on the evaluation set.
      await transaction.rawQuery('SET LOCAL enable_indexscan = off')
      result = (await transaction.rawQuery(
        `WITH dense_candidates AS (
         SELECT c.id,
                row_number() OVER (ORDER BY ce.embedding <=> ?::vector) AS rank
           FROM chunks c
           JOIN chunk_embeddings ce ON ce.chunk_id = c.id
           JOIN processing_runs pr ON pr.id = c.run_id AND pr.status = 'ready'
           JOIN file_revisions fr ON fr.id = c.file_revision_id
           JOIN files f ON f.id = fr.file_id
          WHERE f.id = ANY(?::uuid[])
            AND f.user_id = ?
            AND pr.pipeline_version = ?
            AND ce.model = ?
            AND ce.version = ?
            AND ce.dimensions = ?
          ORDER BY ce.embedding <=> ?::vector
          LIMIT ?
       ), lexical_candidates AS (
         SELECT c.id,
                row_number() OVER (
                  ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', ?)) DESC
                ) AS rank
           FROM chunks c
           JOIN processing_runs pr ON pr.id = c.run_id AND pr.status = 'ready'
           JOIN file_revisions fr ON fr.id = c.file_revision_id
           JOIN files f ON f.id = fr.file_id
          WHERE f.id = ANY(?::uuid[])
            AND f.user_id = ?
            AND pr.pipeline_version = ?
            AND c.content_tsv @@ plainto_tsquery('english', ?)
          ORDER BY ts_rank_cd(c.content_tsv, plainto_tsquery('english', ?)) DESC
          LIMIT ?
       ), reciprocal_rank AS (
         SELECT id, SUM(1.0 / (? + rank)) AS score
           FROM (
             SELECT id, rank FROM dense_candidates
             UNION ALL
             SELECT id, rank FROM lexical_candidates
           ) candidates
          GROUP BY id
       )
       SELECT DISTINCT ON (c.id)
              c.id,
              c.chunk_index,
              c.kind,
              c.content,
              f.filename AS file_name,
              b.source_locator->>'fileKey' AS file_key,
              b.source_locator->>'fileUrl' AS file_url,
              b.source_locator->>'mediaType' AS media_type,
              NULLIF(b.source_locator->>'pageNumber', '')::integer AS page_number,
              rr.score
         FROM reciprocal_rank rr
         JOIN chunks c ON c.id = rr.id
         JOIN file_revisions fr ON fr.id = c.file_revision_id
         JOIN files f ON f.id = fr.file_id
         JOIN chunk_blocks cb ON cb.chunk_id = c.id
         JOIN document_blocks b ON b.id = cb.document_block_id
        WHERE f.user_id = ?
        ORDER BY c.id, rr.score DESC`,
        [
          queryVector,
          fileIds,
          ownerId,
          openRouterApiConfig.pipelineVersion,
          openRouterApiConfig.embeddingModel,
          openRouterApiConfig.pipelineVersion,
          openRouterApiConfig.embeddingDimensions,
          queryVector,
          DENSE_CANDIDATES,
          query,
          fileIds,
          ownerId,
          openRouterApiConfig.pipelineVersion,
          query,
          query,
          LEXICAL_CANDIDATES,
          RRF_CONSTANT,
          ownerId,
        ]
      )) as { rows: SearchRow[] }
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }

    const rankedRows = result.rows.sort((left, right) => Number(right.score) - Number(left.score))
    const isUsableImage = (row: SearchRow) =>
      row.kind === 'image' && Boolean(row.file_url) && row.media_type?.startsWith('image/') === true
    const rankedImageIds = new Set(rankedRows.filter(isUsableImage).map((row) => row.id))
    const supplementalImages = await db.rawQuery<{ rows: SearchRow[] }>(
      `SELECT id,
              chunk_index,
              kind,
              content,
              file_name,
              file_key,
              file_url,
              media_type,
              page_number,
              score
         FROM (
           SELECT c.id,
                  c.chunk_index,
                  c.kind,
                  c.content,
                  f.filename AS file_name,
                  b.source_locator->>'fileKey' AS file_key,
                  b.source_locator->>'fileUrl' AS file_url,
                  b.source_locator->>'mediaType' AS media_type,
                  NULLIF(b.source_locator->>'pageNumber', '')::integer AS page_number,
                  f.id AS source_file_id,
                  row_number() OVER (PARTITION BY f.id ORDER BY c.chunk_index) AS file_rank,
                  0::float8 AS score
             FROM chunks c
             JOIN processing_runs pr ON pr.id = c.run_id AND pr.status = 'ready'
             JOIN file_revisions fr ON fr.id = c.file_revision_id
             JOIN files f ON f.id = fr.file_id
             JOIN chunk_blocks cb ON cb.chunk_id = c.id
             JOIN document_blocks b ON b.id = cb.document_block_id
            WHERE c.kind = 'image'
              AND b.source_locator->>'fileUrl' IS NOT NULL
              AND b.source_locator->>'mediaType' LIKE 'image/%'
              AND f.id = ANY(?::uuid[])
              AND f.user_id = ?
              AND pr.pipeline_version = ?
         ) image_candidates
        ORDER BY file_rank, source_file_id
        LIMIT ?`,
      [fileIds, ownerId, openRouterApiConfig.pipelineVersion, MAX_SOURCE_IMAGES]
    )
    const sourceRows = [...result.rows, ...supplementalImages.rows]
    const fileKeys = [...new Set(sourceRows.flatMap((row) => (row.file_key ? [row.file_key] : [])))]
    const publicUrls = new Map<string, string>()
    await Promise.all(
      fileKeys.map(async (fileKey) => {
        publicUrls.set(fileKey, await drive.use().getUrl(fileKey))
      })
    )
    for (const row of sourceRows) {
      if (row.file_key) row.file_url = publicUrls.get(row.file_key) ?? row.file_url
    }

    const imageRows = [
      ...rankedRows.filter(isUsableImage),
      ...supplementalImages.rows.filter((row) => !rankedImageIds.has(row.id)),
    ].slice(0, MAX_SOURCE_IMAGES)
    const imageFileKeys = [
      ...new Set(imageRows.flatMap((row) => (row.file_key ? [row.file_key] : []))),
    ]
    const signedImageUrls = new Map<string, string>()
    await Promise.all(
      imageFileKeys.map(async (fileKey) => {
        signedImageUrls.set(
          fileKey,
          await drive.use().getSignedUrl(fileKey, { expiresIn: 30 * 60 })
        )
      })
    )
    const textRows = rankedRows.filter((row) => row.kind !== 'image')
    const maxTextChunks = MAX_CONTEXT_CHUNKS - imageRows.length
    const imageReserve = Math.min(tokenBudget / 2, imageRows.length * MAX_CHUNK_TOKENS)
    const textTokenBudget = tokenBudget - imageReserve

    const selected: SourceChunk[] = []
    let usedTextTokens = 0

    for (const row of textRows) {
      const chunk: SourceChunk = {
        id: row.id,
        chunkIndex: Number(row.chunk_index),
        content: row.content,
        fileName: row.file_name,
        fileUrl: row.file_url,
        mediaType: row.media_type,
        pageNumber: row.page_number === null ? null : Number(row.page_number),
      }
      const cost = countTokens(`${chunk.fileName}\n${chunk.content}`)
      if (usedTextTokens + cost > textTokenBudget) continue

      usedTextTokens += cost
      selected.push(chunk)
      if (selected.length === maxTextChunks) break
    }

    let usedTokens = usedTextTokens
    for (const row of imageRows) {
      const chunk: SourceChunk = {
        id: row.id,
        chunkIndex: Number(row.chunk_index),
        content: row.content,
        fileName: row.file_name,
        fileUrl: row.file_url,
        modelFileUrl: row.file_key
          ? (signedImageUrls.get(row.file_key) ?? row.file_url)
          : row.file_url,
        mediaType: row.media_type,
        pageNumber: row.page_number === null ? null : Number(row.page_number),
      }
      const cost = countTokens(`${chunk.fileName}\n${chunk.content}`)
      if (usedTokens + cost > tokenBudget) continue

      usedTokens += cost
      selected.push(chunk)
    }

    return selected
  }
}
