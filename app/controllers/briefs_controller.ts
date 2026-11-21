import type { HttpContext } from '@adonisjs/core/http'
import DocumentPolicy from '#policies/document_policy'
import BriefService from '#services/documents/brief_service'
import { briefValidator } from '#validators/brief'

export default class BriefsController {
  /** Writes a short case-study brief from the best passages of the chosen project and sources. */
  async store({ request, response, workspaceAccess, bouncer }: HttpContext) {
    await bouncer.with(DocumentPolicy).authorize('create', workspaceAccess!.workspaceId)
    const payload = await request.validateUsing(briefValidator)
    return response.ok({ data: await new BriefService().generate(workspaceAccess!, payload) })
  }
}
