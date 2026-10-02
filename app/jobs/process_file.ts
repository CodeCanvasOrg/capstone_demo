import { exponentialBackoff, Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import Document from '#models/document'
import ProcessingRun from '#models/processing_run'
import GenerateDocument from './generate_document.ts'
import ProcessingService from '#services/documents/processing_service'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

interface ProcessFilePayload {
  runId: string
  fileId: string
}

export default class ProcessFile extends Job<ProcessFilePayload> {
  static options: JobOptions = {
    queue: 'documents',
    timeout: '20m',
    retry: {
      maxRetries: 3,
      backoff: exponentialBackoff({ baseDelay: '2s', maxDelay: '2m', jitter: true }),
    },
  }

  async execute() {
    const heartbeat = setInterval(() => {
      void ProcessingRun.query()
        .where('id', this.payload.runId)
        .where('status', 'processing')
        .update({ leaseAt: DateTime.now() })
        .catch((error) =>
          logger.warn({ err: error, runId: this.payload.runId }, 'Processing heartbeat failed')
        )
    }, 30_000)
    heartbeat.unref()

    try {
      const service = new ProcessingService()
      await service.processRun(this.payload.runId, { forceClaim: this.context.stalledCount > 0 })

      const linkedDocuments = await db.rawQuery<{ rows: { document_id: string }[] }>(
        'SELECT DISTINCT document_id FROM document_files WHERE files_id = ?',
        [this.payload.fileId]
      )

      for (const { document_id: documentId } of linkedDocuments.rows) {
        const runs = await db.rawQuery<{ rows: { status: string }[] }>(
          `SELECT latest.status
             FROM document_files df
             LEFT JOIN LATERAL (
               SELECT pr.status
                 FROM file_revisions fr
                 JOIN processing_runs pr ON pr.file_revision_id = fr.id
                WHERE fr.file_id = df.files_id
                ORDER BY fr.revision DESC, pr.created_at DESC
                LIMIT 1
             ) latest ON true
            WHERE df.document_id = ?`,
          [documentId]
        )
        if (runs.rows.length === 0 || runs.rows.some((run) => run.status !== 'ready')) continue

        const claimed = await Document.query()
          .where('id', documentId)
          .where('generationStatus', 'uploaded')
          .update({ generationStatus: 'processing', generationError: null })
        if (claimed.length === 0) continue

        try {
          await GenerateDocument.dispatch({ documentId })
        } catch (error) {
          await Document.query()
            .where('id', documentId)
            .where('generationStatus', 'processing')
            .update({ generationStatus: 'uploaded' })
          throw error
        }
      }
    } finally {
      clearInterval(heartbeat)
    }
  }

  async failed(error: Error) {
    await ProcessingRun.query()
      .where('id', this.payload.runId)
      .where('status', '!=', 'ready')
      .update({
        status: 'failed',
        error: error.message,
        leaseAt: null,
        completedAt: DateTime.now(),
      })
    const linkedDocuments = await db.rawQuery<{ rows: { document_id: string }[] }>(
      'SELECT DISTINCT document_id FROM document_files WHERE files_id = ?',
      [this.payload.fileId]
    )
    for (const { document_id: documentId } of linkedDocuments.rows) {
      await Document.query()
        .where('id', documentId)
        .whereIn('generationStatus', ['uploaded', 'processing', 'generating'])
        .update({
          generationStatus: 'failed',
          generationError: error.message,
          generationLeaseAt: null,
        })
    }
    logger.error({ err: error, runId: this.payload.runId }, 'File processing exhausted its retries')
  }
}
