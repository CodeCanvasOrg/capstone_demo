import Document from '#models/document'
import FileRevision from '#models/file_revision'
import ProcessingRun from '#models/processing_run'
import type User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import openRouterApiConfig from '#config/open_router'
import { DateTime } from 'luxon'
import ProcessFile from '../../jobs/process_file.ts'
import GenerateDocument from '../../jobs/generate_document.ts'

type DocumentInput = {
  title: string
  description: string | null
  status: 'pending' | 'draft' | 'editing' | 'approved' | null
}

type UploadedFile = { id: string }

export default class DocumentGenerationService {
  async create(user: User, input: DocumentInput, submittedFiles: UploadedFile[] = []) {
    const fileIds = [...new Set(submittedFiles.map((file) => file.id))]
    const files = fileIds.length ? await user.related('files').query().whereIn('id', fileIds) : []

    if (files.length !== fileIds.length) {
      throw new Error('One or more selected files do not belong to this user')
    }

    const transaction = await db.transaction()
    const processingRuns: Array<{ runId: string; fileId: string }> = []
    let document: Document

    try {
      document = await user.related('documents').create(
        {
          ...input,
          status: 'pending',
          generationStatus: 'uploaded',
          generationError: null,
        },
        { client: transaction }
      )
      if (fileIds.length) await document.related('files').attach(fileIds, transaction)

      for (const file of files) {
        let revision = await FileRevision.query({ client: transaction })
          .where('fileId', file.id)
          .orderBy('revision', 'desc')
          .first()

        if (!revision) {
          revision = await file.related('revisions').create(
            {
              revision: 1,
              sourceHash: null,
              sourceUrl: null,
              mime: null,
              byteSize: null,
            },
            { client: transaction }
          )
        }

        let run = await ProcessingRun.query({ client: transaction })
          .where('fileRevisionId', revision.id)
          .orderBy('createdAt', 'desc')
          .first()

        const runMatchesCurrentPipeline =
          run?.pipelineVersion === openRouterApiConfig.pipelineVersion &&
          run.embeddingModel === openRouterApiConfig.embeddingModel &&
          run.embeddingDimensions === openRouterApiConfig.embeddingDimensions

        if (!run || run.status === 'failed' || !runMatchesCurrentPipeline) {
          if (run && run.status === 'queued' && !runMatchesCurrentPipeline) {
            run.merge({
              status: 'failed',
              error: 'Superseded by a newer RAG pipeline configuration',
              completedAt: DateTime.now(),
            })
            await run.useTransaction(transaction).save()
          }

          run = await revision.related('processingRuns').create(
            {
              pipelineVersion: openRouterApiConfig.pipelineVersion,
              status: 'queued',
              stageTimings: {},
              warnings: [],
              embeddingModel: openRouterApiConfig.embeddingModel,
              embeddingDimensions: openRouterApiConfig.embeddingDimensions,
            },
            { client: transaction }
          )
        }

        if (run.status !== 'ready') processingRuns.push({ runId: run.id, fileId: file.id })
      }

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }

    try {
      if (processingRuns.length) {
        for (const processingRun of processingRuns) await ProcessFile.dispatch(processingRun)
      } else {
        const claimed = await Document.query()
          .where('id', document.id)
          .where('generationStatus', 'uploaded')
          .update({ generationStatus: 'processing' })
        if (claimed.length) await GenerateDocument.dispatch({ documentId: document.id })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Background work could not be queued'
      await Document.query().where('id', document.id).update({
        generationStatus: 'failed',
        generationError: message,
        generationLeaseAt: null,
      })
      logger.error({ err: error, documentId: document.id }, 'Could not queue document processing')
    }

    return document
  }
}
