import openRouterApiConfig from '#config/open_router'
import Chunk from '#models/chunk'
import ChunkEmbedding from '#models/chunk_embedding'
import DocumentBlock from '#models/document_block'
import ProcessingRun from '#models/processing_run'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

import ChunkingService from '#services/documents/chunking_service'
import EmbeddingService from '#services/documents/embedding_service'
import FileService from '#services/documents/files_service'
import type { CanonicalBlock } from './rag_types.ts'

export default class ProcessingService {
  private readonly chunker = new ChunkingService()
  private readonly embeddings = new EmbeddingService()

  async processRun(runId: string, { forceClaim = false }: { forceClaim?: boolean } = {}) {
    let run = await ProcessingRun.query()
      .where('id', runId)
      .preload('revision', (revision) => revision.preload('file'))
      .preload('blocks', (blocks) => blocks.orderBy('orderIndex', 'asc'))
      .firstOrFail()

    if (run.status === 'ready') return { alreadyReady: true, chunks: 0 }

    const claim = await db.rawQuery<{ rows: { id: string }[] }>(
      `UPDATE processing_runs
          SET status = 'processing',
              started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
              lease_at = CURRENT_TIMESTAMP,
              error = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND (
            status = 'queued'
            OR (status = 'processing' AND (lease_at IS NULL OR lease_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes' OR ?))
          )
        RETURNING id`,
      [runId, forceClaim]
    )
    if (claim.rows.length === 0) {
      run = await ProcessingRun.findByOrFail({ id: runId })
      return {
        alreadyReady: run.status === 'ready',
        alreadyProcessing: run.status === 'processing',
        chunks: 0,
      }
    }

    run = await ProcessingRun.query()
      .where('id', runId)
      .preload('revision', (revision) => revision.preload('file'))
      .preload('blocks', (blocks) => blocks.orderBy('orderIndex', 'asc'))
      .firstOrFail()

    const revision = run.revision
    const file = revision.file
    const stageTimings = { ...(run.stageTimings ?? {}) }
    let generatedAssetKeys: string[] = []

    try {
      const startedAt = Date.now()
      let canonicalBlocks: CanonicalBlock[]
      let processedFile: Awaited<ReturnType<typeof FileService.processFile>> | undefined

      if (stageTimings.extraction !== undefined) {
        canonicalBlocks = run.blocks.map((block) => ({
          id: block.id,
          blockType: block.blockType,
          text: block.text,
          orderIndex: block.orderIndex,
          sectionPath: block.sectionPath,
          sourceLocator: block.sourceLocator,
          extractionMethod: block.extractionMethod,
          confidence: block.confidence,
        }))
      } else {
        const extractionStartedAt = Date.now()
        processedFile = await FileService.processFile(
          {
            id: file.id,
            filename: file.filename ?? 'Untitled file',
            objectKey: file.objectKey ?? '',
          },
          file.userId
        )
        generatedAssetKeys = processedFile.generatedAssetKeys
        canonicalBlocks = processedFile.blocks
        stageTimings.extraction = Date.now() - extractionStartedAt
      }

      const chunkingStartedAt = Date.now()
      const prepared = await this.chunker.chunk(canonicalBlocks)
      stageTimings.chunking ??= Date.now() - chunkingStartedAt

      if (processedFile) {
        const extractionTransaction = await db.transaction()
        try {
          if (prepared.blocks.length) {
            await DocumentBlock.createMany(
              prepared.blocks.map((block) => ({
                id: block.id,
                processingRunId: run.id,
                blockType: block.blockType,
                text: block.text,
                rawReference: null,
                orderIndex: block.orderIndex,
                sectionPath: block.sectionPath,
                sourceLocator: block.sourceLocator,
                extractionMethod: block.extractionMethod,
                confidence: block.confidence,
              })),
              { client: extractionTransaction }
            )
          }

          revision.merge({
            sourceHash: processedFile.sourceHash,
            sourceUrl: processedFile.objectUrl,
            mime: processedFile.mimeType,
            byteSize: processedFile.byteSize,
            retrievedAt: DateTime.now(),
          })
          await revision.useTransaction(extractionTransaction).save()

          file.objectUrl = processedFile.objectUrl
          await file.useTransaction(extractionTransaction).save()

          run.stageTimings = { ...stageTimings }
          await run.useTransaction(extractionTransaction).save()
          await extractionTransaction.commit()
          generatedAssetKeys = []
        } catch (error) {
          await extractionTransaction.rollback()
          throw error
        }
      }

      const embeddingStartedAt = Date.now()
      const vectors = await this.embedWithCache(prepared.chunks)
      stageTimings.embedding = Date.now() - embeddingStartedAt

      const persistenceStartedAt = Date.now()
      const transaction = await db.transaction()
      try {
        await transaction.from('chunks').where('run_id', run.id).delete()

        if (prepared.chunks.length) {
          await Chunk.createMany(
            prepared.chunks.map((chunk) => ({
              id: chunk.id,
              fileId: file.id,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              fileKey: chunk.fileKey,
              embedding: null,
              runId: run.id,
              fileRevisionId: revision.id,
              kind: chunk.kind,
              tokenCount: chunk.tokenCount,
              contentHash: chunk.contentHash,
            })),
            { client: transaction }
          )
        }

        const chunkBlockRows = prepared.chunks.flatMap((chunk) =>
          chunk.blockIds.map((blockId) => ({
            chunk_id: chunk.id,
            document_block_id: blockId,
          }))
        )
        if (chunkBlockRows.length) await transaction.table('chunk_blocks').insert(chunkBlockRows)

        await this.insertEmbeddings(transaction, prepared.chunks, vectors)

        run.status = 'ready'
        run.stageTimings = {
          ...stageTimings,
          persistence: Date.now() - persistenceStartedAt,
          total: Date.now() - startedAt,
        }
        run.warnings = prepared.blocks.length ? [] : ['No text or visual blocks were extracted']
        run.embeddingModel = openRouterApiConfig.embeddingModel
        run.embeddingDimensions = openRouterApiConfig.embeddingDimensions
        run.error = null
        run.completedAt = DateTime.now()
        run.leaseAt = null
        await run.useTransaction(transaction).save()

        await transaction.commit()
      } catch (error) {
        await transaction.rollback()
        throw error
      }

      return { alreadyReady: false, chunks: prepared.chunks.length }
    } catch (error) {
      if (generatedAssetKeys.length) await FileService.cleanupGeneratedAssets(generatedAssetKeys)
      const message = error instanceof Error ? error.message : 'File processing failed'
      try {
        await ProcessingRun.query().where('id', run.id).update({
          error: message,
          leaseAt: null,
        })
      } catch (updateError) {
        logger.warn({ err: updateError, runId }, 'Could not save processing error details')
      }
      throw error
    }
  }

  private async embedWithCache(chunks: { content: string; inputHash: string }[]) {
    if (chunks.length === 0) return [] as number[][]

    const inputHashes = [
      ...new Set(chunks.map((chunk) => this.embeddings.inputHash(chunk.content))),
    ]
    const cachedRows = await ChunkEmbedding.query()
      .whereIn('inputHash', inputHashes)
      .where('model', openRouterApiConfig.embeddingModel)
      .where('version', openRouterApiConfig.pipelineVersion)
      .where('dimensions', openRouterApiConfig.embeddingDimensions)
      .select('inputHash', 'embedding')

    const cache = new Map<string, number[]>()
    for (const row of cachedRows) {
      if (!cache.has(row.inputHash)) cache.set(row.inputHash, this.parseVector(row.embedding))
    }

    const missing = new Map<string, string>()
    for (const chunk of chunks) {
      const inputHash = this.embeddings.inputHash(chunk.content)
      if (!cache.has(inputHash)) missing.set(inputHash, chunk.content)
    }

    if (missing.size) {
      const missingItems = [...missing.entries()]
      const vectors = await this.embeddings.embedTexts(missingItems.map(([, content]) => content))
      missingItems.forEach(([inputHash], index) => cache.set(inputHash, vectors[index]))
    }

    return chunks.map((chunk) => cache.get(this.embeddings.inputHash(chunk.content)) ?? [])
  }

  private async insertEmbeddings(
    transaction: Awaited<ReturnType<typeof db.transaction>>,
    chunks: { id: string; content: string; inputHash: string }[],
    vectors: number[][]
  ) {
    const rows = chunks.map((chunk, index) => ({
      chunkId: chunk.id,
      model: openRouterApiConfig.embeddingModel,
      version: openRouterApiConfig.pipelineVersion,
      dimensions: openRouterApiConfig.embeddingDimensions,
      embedding: vectors[index],
      inputHash: this.embeddings.inputHash(chunk.content),
    }))

    const values: string[] = []
    const bindings: Array<string | number> = []
    for (const row of rows) {
      values.push('(?, ?, ?, ?, ?::vector, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')
      bindings.push(
        row.chunkId,
        row.model,
        row.version,
        row.dimensions,
        JSON.stringify(row.embedding),
        row.inputHash
      )
    }

    if (values.length) {
      await transaction.rawQuery(
        `INSERT INTO chunk_embeddings (chunk_id, model, version, dimensions, embedding, input_hash, created_at, updated_at) VALUES ${values.join(', ')}`,
        bindings
      )
    }
  }

  private parseVector(value: string) {
    const vector = value
      .replace(/[\[\]]/g, '')
      .split(',')
      .filter(Boolean)
      .map(Number)

    if (
      vector.length !== openRouterApiConfig.embeddingDimensions ||
      vector.some((number) => !Number.isFinite(number))
    ) {
      throw new Error('Cached embedding has an invalid dimension or contains invalid values')
    }

    return vector
  }
}
