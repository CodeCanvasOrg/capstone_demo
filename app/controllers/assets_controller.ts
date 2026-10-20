import type { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import AccessService, { missingResource, uuid } from '#services/workspaces/access_service'
import EvidenceService from '#services/documents/evidence_service'
export default class AssetsController {
  async download({ workspaceAccess, params, response }: HttpContext) {
    const context = workspaceAccess!
    const access = new AccessService()
    const asset = await db.transaction(async (trx) => {
      await access.lock(context, trx)
      const file = await access.file(context, params.id)
      if (!file.objectKey) throw missingResource()
      return {
        stream: await drive.use().getStream(file.objectKey),
        filename: file.filename ?? 'source',
        filetype: file.filetype,
      }
    })
    const mime: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.txt': 'text/plain',
      '.md': 'text/plain',
      '.markdown': 'text/plain',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
    return response
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Security-Policy', "sandbox; default-src 'none'")
      .header('Content-Type', mime[asset.filetype ?? ''] ?? 'application/octet-stream')
      .header(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(asset.filename)}`
      )
      .stream(asset.stream)
  }
  async derived({ workspaceAccess, params, response }: HttpContext) {
    const context = workspaceAccess!
    await new AccessService().file(context, params.id)
    if (!uuid(params.revisionId) || !uuid(params.assetId)) throw missingResource()
    const row = await db
      .from('document_blocks as b')
      .join('processing_runs as pr', (join) =>
        join.on('pr.id', 'b.processing_run_id').andOn('pr.workspace_id', 'b.workspace_id')
      )
      .join('file_revisions as fr', (join) =>
        join.on('fr.id', 'pr.file_revision_id').andOn('fr.workspace_id', 'pr.workspace_id')
      )
      .where({
        'b.workspace_id': context.workspaceId,
        'b.id': params.assetId,
        'fr.id': params.revisionId,
        'fr.file_id': params.id,
        'b.block_type': 'image',
      })
      .select('b.source_locator')
      .first()
    if (!row || typeof row.source_locator?.fileKey !== 'string') throw missingResource()
    await new EvidenceService().check(context)
    const mime = row.source_locator.mediaType
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime))
      throw missingResource()
    return response
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Type', mime)
      .stream(await drive.use().getStream(row.source_locator.fileKey))
  }
  async evidence({ workspaceAccess, params, response }: HttpContext) {
    const service = new EvidenceService()
    const row = await service.chunk(workspaceAccess!, params.documentId, params.chunkId)
    return response
      .header('Cache-Control', 'private, no-store')
      .ok({ data: service.source(workspaceAccess!, params.documentId, row) })
  }
  async asset({ workspaceAccess, params, response }: HttpContext) {
    const result = await new EvidenceService().asset(
      workspaceAccess!,
      params.documentId,
      params.chunkId
    )
    return response
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Security-Policy', "sandbox; default-src 'none'")
      .header('Content-Type', result.mime)
      .stream(result.stream)
  }
}
