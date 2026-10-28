import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
export default class ConvertTemplateDocuments extends BaseCommand {
  static commandName = 'convert:template-documents'
  static description = 'Preserve existing template drafts as ordinary editable documents'
  static options: CommandOptions = { startApp: true }
  async run() {
    const { default: Document } = await import('#models/document')
    const { default: AccessService } = await import('#services/workspaces/access_service')
    const { default: LegacyTemplateService } =
      await import('#services/documents/legacy_template_service')
    let converted = 0
    for (const doc of await Document.query().where('contentMode', 'template')) {
      const { context } = await new AccessService().resolve(doc.userId, doc.workspaceId!)
      if (await new LegacyTemplateService().convert(context, doc.id)) converted++
    }
    this.logger.success(
      `Converted ${converted} documents. Original versions and terminal tasks preserved.`
    )
  }
}
