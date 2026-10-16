import RichTextService from '#services/rich_text_service'
import db from '@adonisjs/lucid/services/db'
import Project from '#models/project'
import AccessService, { type WorkspaceAccessContext } from '#services/workspaces/access_service'
export default class ProjectService {
  async save(
    context: WorkspaceAccessContext,
    input: { name: string; description?: string | null; descriptionContent?: unknown },
    id?: string
  ) {
    const { descriptionContent, ...plain } = input
    const values = descriptionContent
      ? { ...plain, ...new RichTextService().description(descriptionContent, 10000) }
      : { ...plain, descriptionContent: null }
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      if (!id)
        return Project.create(
          { ...values, workspaceId: context.workspaceId, creatorId: context.actorId },
          { client: trx }
        )
      const project = await Project.query({ client: trx })
        .where({ id, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      return project.merge(values).save()
    })
  }
}
