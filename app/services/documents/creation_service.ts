import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import DocumentService, { type DocumentInput } from '#services/documents/document_service'
import GenerationService from '#services/documents/generation_service'
import ProjectService from '#services/workspaces/project_service'
import OutlineTemplateService from '#services/documents/outline_template_service'
import { type WorkspaceAccessContext } from '#services/workspaces/access_service'
export default class CreationService {
  async document(
    context: WorkspaceAccessContext,
    input: DocumentInput & { templateId?: string },
    fileIds: string[],
    client?: TransactionClientContract
  ) {
    const create = async (trx: TransactionClientContract) => {
      const outline = await new OutlineTemplateService().resolve(input.templateId ?? 'portfolio')
      const doc = await new DocumentService().create(context, input, fileIds, trx)
      doc.merge({ selectedTemplateVersionId: null, templateSetup: { outline } })
      await doc.save()
      await new GenerationService().request(context, doc.id, randomUUID(), null, trx)
      return doc
    }
    return client ? create(client) : db.transaction(create)
  }
  async project(
    context: WorkspaceAccessContext,
    input: { name: string; description?: string | null; descriptionContent?: unknown }
  ) {
    return db.transaction(async (trx) => {
      const project = await new ProjectService().save(context, input, undefined, trx)
      return this.document(
        context,
        {
          title: project.name,
          description: project.description,
          descriptionContent: project.descriptionContent,
          projectId: project.id,
          sourceMode: 'input_only',
          projectInformation: { overview: project.description ?? project.name },
        },
        [],
        trx
      )
    })
  }
}
