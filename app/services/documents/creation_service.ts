import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import DocumentService, { type DocumentInput } from '#services/documents/document_service'
import GenerationService from '#services/documents/generation_service'
import ProjectService from '#services/workspaces/project_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'

export default class CreationService {
  async document(context: WorkspaceAccessContext, input: DocumentInput, fileIds: string[]) {
    return db.transaction(async (trx) => {
      const document = await new DocumentService().create(context, input, fileIds, trx)
      await new GenerationService().request(context, document.id, randomUUID(), null, trx)
      return document
    })
  }

  async project(
    context: WorkspaceAccessContext,
    input: { name: string; description?: string | null; descriptionContent?: unknown }
  ) {
    return db.transaction(async (trx) => {
      const project = await new ProjectService().save(context, input, undefined, trx)
      const document = await new DocumentService().create(
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
      await new GenerationService().request(context, document.id, randomUUID(), null, trx)
      return document
    })
  }
}
