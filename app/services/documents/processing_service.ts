import db from '@adonisjs/lucid/services/db'
import openRouterApiConfig from '#config/open_router'
import ProcessingRun from '#models/processing_run'
import Chunk from '#models/chunk'
import DocumentBlock from '#models/document_block'
import { DateTime } from 'luxon'
import ChunkingService from '#services/documents/chunking_service'
import EmbeddingService, { embeddingInput } from '#services/documents/embedding_service'
import FileService from '#services/documents/files_service'
import TaskService, { type TaskLease } from '#services/workspaces/task_service'
import { isCurrentRun } from '#services/documents/pipeline_identity'

export default class ProcessingService {
  async processRun(lease: TaskLease) {
    const tasks = new TaskService()
    await tasks.check(lease)
    const run = await ProcessingRun.query()
      .where({ id: lease.task.runId!, workspaceId: lease.context.workspaceId })
      .preload('revision', (revision) => revision.preload('file'))
      .firstOrFail()
    if (!isCurrentRun(run))
      throw new Error('Processing configuration changed; request a new preparation run')
    const file = run.revision.file
    if (file.id !== lease.task.fileId || file.workspaceId !== lease.context.workspaceId)
      throw new Error('Invalid processing lineage')
    if (run.status === 'ready') {
      await tasks.finish(lease)
      return
    }
    await db.transaction(async (trx) => {
      await tasks.lock(lease, trx)
      await ProcessingRun.query({ client: trx })
        .where({ id: run.id, workspaceId: lease.context.workspaceId })
        .update({ status: 'processing', startedAt: DateTime.utc(), error: null })
    })

    const extracted = await FileService.processFile(
      {
        id: file.id,
        filename: file.filename ?? 'Untitled',
        objectKey: file.objectKey ?? '',
        uploaderId: file.userId,
      },
      lease.context,
      () => tasks.check(lease)
    )
    try {
      const prepared = await new ChunkingService().chunk(extracted.blocks)
      await tasks.check(lease) // Immediately before private content is disclosed to the embedding provider.
      const vectors = prepared.chunks.length
        ? await new EmbeddingService().embedTexts(prepared.chunks.map(embeddingInput), () =>
            tasks.check(lease)
          )
        : []
      await tasks.finish(lease, async (trx) => {
        const lockedRun = await ProcessingRun.query({ client: trx })
          .where({ id: run.id, workspaceId: lease.context.workspaceId })
          .forUpdate()
          .firstOrFail()
        await trx
          .from('chunks')
          .where({ workspace_id: lease.context.workspaceId, run_id: run.id })
          .delete()
        await trx
          .from('document_blocks')
          .where({ workspace_id: lease.context.workspaceId, processing_run_id: run.id })
          .delete()
        if (prepared.blocks.length)
          await DocumentBlock.createMany(
            prepared.blocks.map((block) => ({
              ...block,
              workspaceId: lease.context.workspaceId,
              processingRunId: run.id,
              rawReference: null,
            })),
            { client: trx }
          )
        if (prepared.chunks.length)
          await Chunk.createMany(
            prepared.chunks.map((chunk) => ({
              id: chunk.id,
              workspaceId: lease.context.workspaceId,
              fileId: file.id,
              fileRevisionId: run.revision.id,
              runId: run.id,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              fileKey: chunk.fileKey,
              kind: chunk.kind,
              tokenCount: chunk.tokenCount,
              contentHash: chunk.contentHash,
            })),
            { client: trx }
          )
        const links = prepared.chunks.flatMap((chunk) =>
          chunk.blockIds.map((blockId) => ({
            workspace_id: lease.context.workspaceId,
            run_id: run.id,
            chunk_id: chunk.id,
            document_block_id: blockId,
          }))
        )
        if (links.length) await trx.table('chunk_blocks').insert(links)
        for (const [index, chunk] of prepared.chunks.entries())
          await trx.rawQuery(
            'INSERT INTO chunk_embeddings (workspace_id,chunk_id,model,version,dimensions,embedding,input_hash,created_at,updated_at) VALUES (?,?,?,?,?,?::vector,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
            [
              lease.context.workspaceId,
              chunk.id,
              openRouterApiConfig.embeddingModel,
              openRouterApiConfig.pipelineVersion,
              openRouterApiConfig.embeddingDimensions,
              JSON.stringify(vectors[index]),
              new EmbeddingService().inputHash(embeddingInput(chunk)),
            ]
          )
        lockedRun.merge({
          status: 'ready',
          warnings: prepared.blocks.length ? [] : ['No text or visual evidence was extracted'],
          stageTimings: { total: Date.now() - lease.task.createdAt.toMillis() },
          embeddingModel: openRouterApiConfig.embeddingModel,
          embeddingDimensions: openRouterApiConfig.embeddingDimensions,
          completedAt: DateTime.utc(),
          leaseAt: null,
          error: null,
        })
        await lockedRun.save()
        return { fileId: file.id, chunks: prepared.chunks.length }
      })
    } catch (error) {
      await FileService.cleanupGeneratedAssets(extracted.generatedAssetKeys)
      throw error
    }
    await tasks.wake(lease.context.workspaceId)
  }
}
