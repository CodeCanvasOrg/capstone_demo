import { exponentialBackoff, Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import Document from '#models/document'
import DocumentVersion from '#models/document_version'
import OpenRouterService from '#services/open_router_service'
import RetrievalService from '#services/documents/retrieval_service'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

interface GenerateDocumentPayload {
  documentId: string
}

export default class GenerateDocument extends Job<GenerateDocumentPayload> {
  static options: JobOptions = {
    queue: 'documents',
    timeout: '10m',
    retry: {
      maxRetries: 3,
      backoff: exponentialBackoff({ baseDelay: '2s', maxDelay: '2m', jitter: true }),
    },
  }

  async execute() {
    let document = await Document.query()
      .where('id', this.payload.documentId)
      .preload('files')
      .firstOrFail()
    if (document.generationStatus === 'ready' || document.generationStatus === 'failed') return

    const isStalledRetry = this.context.stalledCount > 0
    if (document.generationStatus === 'generating' && !isStalledRetry) return

    const claimQuery = Document.query().where('id', document.id)
    if (document.generationStatus === 'generating') {
      claimQuery.where('generationStatus', 'generating')
    } else {
      claimQuery.whereIn('generationStatus', ['uploaded', 'processing'])
    }

    const claimed = await claimQuery.update({
      generationStatus: 'generating',
      generationError: null,
      generationLeaseAt: DateTime.now(),
    })
    if (claimed.length === 0) return

    const heartbeat = setInterval(() => {
      void Document.query()
        .where('id', document.id)
        .where('generationStatus', 'generating')
        .update({ generationLeaseAt: DateTime.now() })
        .catch((error) =>
          logger.warn({ err: error, documentId: document.id }, 'Generation heartbeat failed')
        )
    }, 30_000)
    heartbeat.unref()

    try {
      document = await Document.query().where('id', document.id).preload('files').firstOrFail()
      const sourceChunks = await new RetrievalService().search({
        query: document.description?.trim() || document.title || '',
        fileIds: document.files.map((file) => file.id),
        ownerId: document.userId,
      })
      const content = await new OpenRouterService().generateDocumentWithEvidence(
        document.title || 'Untitled document',
        document.description || '',
        sourceChunks
      )

      const transaction = await db.transaction()
      try {
        const latestVersion = await DocumentVersion.query({ client: transaction })
          .where('documentId', document.id)
          .orderBy('version', 'desc')
          .first()

        await document.related('documentVersions').create(
          {
            content,
            version: (latestVersion?.version ?? 0) + 1,
            userId: document.userId,
          },
          { client: transaction }
        )

        document.merge({
          status: 'draft',
          generationStatus: 'ready',
          generationError: null,
          generationLeaseAt: null,
        })
        await document.useTransaction(transaction).save()
        await transaction.commit()
      } catch (error) {
        await transaction.rollback()
        throw error
      }
    } catch (error) {
      await Document.query()
        .where('id', document.id)
        .where('generationStatus', 'generating')
        .update({
          generationStatus: 'processing',
          generationError: error instanceof Error ? error.message : 'Document generation failed',
          generationLeaseAt: null,
        })
      throw error
    } finally {
      clearInterval(heartbeat)
    }
  }

  async failed(error: Error) {
    await Document.query()
      .where('id', this.payload.documentId)
      .whereIn('generationStatus', ['uploaded', 'processing', 'generating'])
      .update({
        generationStatus: 'failed',
        generationError: error.message,
        generationLeaseAt: null,
      })
    logger.error(
      { err: error, documentId: this.payload.documentId },
      'Document generation exhausted its retries'
    )
  }
}
