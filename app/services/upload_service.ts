import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import { currentRunIdentity } from '#services/documents/pipeline_identity'
import File from '#models/file'
import FileRevision from '#models/file_revision'
import ProcessingRun from '#models/processing_run'
import AccessService, { type WorkspaceAccessContext } from '#services/workspaces/access_service'
import TaskService from '#services/workspaces/task_service'
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
  async upload(
    context: WorkspaceAccessContext,
    { filename, contents }: { filename: string; contents: Buffer }
  ) {
    const filetype = path.extname(filename).toLowerCase()
    const mime = MIME_TYPES[filetype]
    if (!mime || contents.length > 10 * 1024 * 1024 || !contents.length)
      throw new Exception('Choose a supported file up to 10 MB', { status: 422 })
    const objectKey = File.createFileName(`workspaces/${context.workspaceId}/originals`, filetype)
    const access = new AccessService()
    // Keep the membership lock through the private write; revocation serializes with it.
    const file = await db.transaction(async (trx) => {
      await access.lock(context, trx)
      await drive.use().put(objectKey, contents, { contentType: mime, visibility: 'private' })
      try {
        const stored = await File.create(
          {
            workspaceId: context.workspaceId,
            userId: context.actorId,
            filename,
            filetype,
            objectKey,
            objectUrl: null,
          },
          { client: trx }
        )
        const revision = await FileRevision.create(
          {
            workspaceId: context.workspaceId,
            fileId: stored.id,
            revision: 1,
            sourceHash: createHash('sha256').update(contents).digest('hex'),
            sourceUrl: null,
            mime,
            byteSize: contents.length,
            retrievedAt: DateTime.utc(),
          },
          { client: trx }
        )
        const run = await ProcessingRun.create(
          {
            workspaceId: context.workspaceId,
            fileRevisionId: revision.id,
            ...currentRunIdentity(),
            status: 'queued',
            stageTimings: {},
            warnings: [],
          },
          { client: trx }
        )
        await new TaskService().create(
          context,
          {
            kind: 'ingest',
            fileId: stored.id,
            runId: run.id,
            mutationId: randomUUID(),
            payload: {},
          },
          trx
        )
        return stored
      } catch (error) {
        await drive
          .use()
          .delete(objectKey)
          .catch(() => {})
        throw error
      }
    })
    return {
      id: file.id,
      filename: file.filename,
      filetype: file.filetype,
      downloadUrl: `/workspaces/${context.workspaceId}/files/${file.id}/download`,
      processingStatus: 'queued' as const,
    }
  }
}
