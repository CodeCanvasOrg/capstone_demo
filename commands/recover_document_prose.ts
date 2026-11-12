import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'

export default class RecoverDocumentProse extends BaseCommand {
  static commandName = 'documents:recover-prose'
  static description = 'Recover misplaced generated text into a new version of an empty draft'
  static options: CommandOptions = { startApp: true }

  @args.string() declare documentId: string
  @args.string() declare sourceVersionId: string
  @flags.number({ required: true }) declare actor: number
  @flags.string({ required: true }) declare baseVersion: string
  @flags.boolean() declare apply: boolean

  async run() {
    const { randomUUID } = await import('node:crypto')
    const { default: AccessService } = await import('#services/workspaces/access_service')
    const { default: Document } = await import('#models/document')
    const { default: DocumentVersion } = await import('#models/document_version')
    const { default: User } = await import('#models/user')
    const { default: Policy } = await import('#policies/document_version_policy')
    const { default: ContentService } = await import('#services/documents/content_service')
    const { default: VersionService } = await import('#services/documents/version_service')

    const document = await Document.findOrFail(this.documentId)
    if (!document.workspaceId) throw new Error('The document has no active workspace')
    const user = await User.findOrFail(this.actor)
    const { context } = await new AccessService().resolve(user.id, document.workspaceId)
    if (!(await new Policy().create(user, document))) throw new Error('Editing is not authorized')
    if (document.currentVersionId !== this.baseVersion)
      throw new Error('The current version changed; inspect it before recovering')
    if (!['ready', 'failed'].includes(document.generationStatus))
      throw new Error('Wait for generation to finish before recovering')

    const current = await DocumentVersion.query()
      .where({ id: this.baseVersion, documentId: document.id, workspaceId: context.workspaceId })
      .firstOrFail()
    const source = await DocumentVersion.query()
      .where({
        id: this.sourceVersionId,
        documentId: document.id,
        workspaceId: context.workspaceId,
      })
      .firstOrFail()
    const contentService = new ContentService()
    let currentHasProse = true
    try {
      contentService.normalizeGenerated(current.content)
    } catch (error) {
      if (!error || typeof error !== 'object' || !('unusableOutput' in error)) throw error
      currentHasProse = false
    }
    if (currentHasProse)
      throw new Error('The current draft already contains prose; recovery refused')
    const content = contentService.normalizeGenerated(source.content)
    const hasMisplacedText = (node: TipTapDocument['content'][number]): boolean =>
      (node.type !== 'text' && !!node.text?.trim()) || (node.content ?? []).some(hasMisplacedText)
    if (!(source.content as TipTapDocument).content.some(hasMisplacedText))
      throw new Error('The source version contains no misplaced text to recover')

    this.logger.info(`Recover version ${source.version} into empty version ${current.version}`)
    if (!this.apply) {
      this.logger.info(
        'Dry run only. Use --apply with the same --base-version to save a new version.'
      )
      return
    }
    const saved = await new VersionService().save(context, document.id, {
      content,
      baseVersionId: this.baseVersion,
      mutationId: randomUUID(),
    })
    this.logger.success(`Recovered prose into version ${saved.version} (${saved.id})`)
  }
}
