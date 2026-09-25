import Document from '#models/document'
import DocumentPolicy from '#policies/document_policy'
import ExportPdfService from '#services/exports/pdf_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class ExportPdfsController {
  async handle({ params, bouncer, response }: HttpContext) {
    const document = await Document.query()
      .where('id', params.documentId)
      .preload('documentVersions', (query) => query.orderBy('version', 'desc'))
      .firstOrFail()

    await bouncer.with(DocumentPolicy).authorize('edit', document)

    const documentVersion = document.documentVersions[0]

    const pdf = await ExportPdfService.generate(documentVersion)

    return response
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${document.title}.pdf"`)
      .send(pdf)
  }
}
