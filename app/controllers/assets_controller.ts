import type { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import AccessService, { missingResource } from '#services/workspaces/access_service'
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
