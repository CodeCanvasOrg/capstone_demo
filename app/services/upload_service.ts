import { createHash } from 'node:crypto'
import path from 'node:path'

import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

import openRouterApiConfig from '#config/open_router'
import File from '#models/file'
import type User from '#models/user'
import ProcessFile from '../jobs/process_file.ts'

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

export default class UploadService {
  async upload(user: User, { filename, contents }: { filename: string; contents: Buffer }) {
    const filetype = path.extname(filename).toLowerCase()
    const mime = MIME_TYPES[filetype]
    if (!mime) throw new Error(`Unsupported file type: ${filetype}`)

    const objectKey = File.createFileName(`uploads/${user.id}`, filetype)
    const sourceHash = createHash('sha256').update(contents).digest('hex')
    const transaction = await db.transaction()
    let file: File
    let revisionId: string
    let runId: string

    try {
      file = await user.related('files').create(
        {
          filename,
          filetype,
          objectKey,
          objectUrl: null,
        },
        { client: transaction }
      )
      const revision = await file.related('revisions').create(
        {
          revision: 1,
          sourceHash,
          sourceUrl: null,
          mime,
          byteSize: contents.byteLength,
          retrievedAt: DateTime.now(),
        },
        { client: transaction }
      )
      const run = await revision.related('processingRuns').create(
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
      revisionId = revision.id
      runId = run.id
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }

    try {
      await drive.use().put(objectKey, contents, { contentType: mime })
      const objectUrl = await drive.use().getUrl(objectKey)

      file.objectUrl = objectUrl
      await file.save()
      await db.from('file_revisions').where('id', revisionId).update({ source_url: objectUrl })
      await ProcessFile.dispatch({ runId, fileId: file.id })

      return {
        id: file.id,
        filename: file.filename,
        filetype: file.filetype,
        objectKey: file.objectKey,
        objectUrl: file.objectUrl,
        processingStatus: 'uploaded' as const,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File upload could not be queued'
      await db.from('processing_runs').where('id', runId).update({
        status: 'failed',
        error: message,
        completed_at: DateTime.now().toSQL(),
      })
      logger.error(
        { err: error, fileId: file.id },
        'Stored file could not be queued for processing'
      )
      throw error
    }
  }
}
