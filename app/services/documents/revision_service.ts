import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import config from '#config/open_router'
import OpenRouterService from '#services/open_router_service'
import ContentService from '#services/documents/content_service'
import EvidenceService from '#services/documents/evidence_service'
import AccessService, { type WorkspaceAccessContext } from '#services/workspaces/access_service'

export default class RevisionService {
  /**
   * Applies an author's change request to the editor content without saving it;
   * the editor saves the result as a normal version so conflicts and undo still work.
   */
  async revise(
    context: WorkspaceAccessContext,
    documentId: string,
    input: { content: unknown; instruction: string }
  ) {
    await new AccessService().document(context, documentId)
    const content = new ContentService().normalize(input.content, { repair: true })
    let revised: Awaited<ReturnType<OpenRouterService['reviseDocument']>>
    try {
      revised = await new OpenRouterService().reviseDocument(content, input.instruction)
    } catch (error) {
      logger.warn({ err: error, documentId }, 'Change request failed')
      const status = OpenRouterService.status(error)
      throw new Exception(
        (status && config.failureMessages[status]) ||
          'The change could not be made. Your content is unchanged. Try again.',
        { status: status === 429 ? 429 : 502, code: 'E_REVISION_FAILED' }
      )
    }
    const normalized = new ContentService().normalize(revised.document, { repair: true })
    return {
      content: await new EvidenceService().hydrate(context, documentId, normalized),
      summary: revised.summary,
      changed: revised.changed,
    }
  }
}
