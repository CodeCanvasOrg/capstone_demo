import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class MapPublicationDocument extends BaseCommand {
  static commandName = 'publication:map-document'
  static description =
    'Map one document to publication metadata v1 (dry-run unless --apply); appends a normal version'
  static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'User ID acting on the document' })
  declare actor: number
  @flags.string({ description: 'Workspace UUID' })
  declare workspace: string
  @flags.string({ description: 'Document UUID' })
  declare document: string
  @flags.string({ description: 'Expected current version UUID', alias: 'base-version' })
  declare baseVersion: string
  @flags.string({ description: 'Mutation UUID; required with --apply, reuse it to replay' })
  declare mutationId?: string
  @flags.boolean({ description: 'Append the mapped version instead of reporting only' })
  declare apply: boolean

  async run() {
    if (!this.actor || !this.workspace || !this.document || !this.baseVersion)
      return this.fail('--actor, --workspace, --document and --base-version are required')
    if (this.apply && !this.mutationId) return this.fail('--mutation-id is required with --apply')
    const { default: AccessService } = await import('#services/workspaces/access_service')
    const { default: DocumentVersion } = await import('#models/document_version')
    const { default: VersionService } = await import('#services/documents/version_service')
    const { default: PublicationContentService } =
      await import('#services/documents/publication_content_service')

    const { context } = await new AccessService().resolve(this.actor, this.workspace)
    const document = await new AccessService().document(context, this.document)
    if (document.currentVersionId !== this.baseVersion)
      return this.fail('The current version differs from --base-version; nothing was changed')
    const version = await DocumentVersion.findOrFail(this.baseVersion)
    const service = new PublicationContentService()
    const { document: mapped, report } = service.mapLegacy(
      version.content as never,
      `${this.document}:${this.baseVersion}`
    )
    const summary = {
      mapped: report.mapped,
      identitiesAssigned: report.identitiesAssigned,
      preservedNodes: report.preservedNodes,
      unresolved: report.unresolved,
      baseHash: service.contentHash(version.content as never),
      mappedHash: service.contentHash(mapped),
    }
    this.logger.info(JSON.stringify(summary, null, 2))
    if (!this.apply) return this.logger.info('Dry run: no version was written')
    if (!report.mapped) return this.fail('Nothing to apply; see the report above')
    const saved = await new VersionService().save(context, this.document, {
      content: mapped,
      baseVersionId: this.baseVersion,
      mutationId: this.mutationId!,
    })
    this.logger.success(
      `Version ${saved.version} (${saved.id}) saved; earlier versions are unchanged`
    )
  }

  private fail(message: string) {
    this.logger.error(message)
    this.exitCode = 1
  }
}
