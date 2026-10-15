import db from '@adonisjs/lucid/services/db'
import Project from '#models/project'
import AccessService, { type WorkspaceAccessContext } from '#services/workspaces/access_service'
export default class ProjectService {
  async save(
    context: WorkspaceAccessContext,
    input: { name: string; description?: string | null },
    id?: string
  ) {
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      if (!id)
        return Project.create(
          { ...input, workspaceId: context.workspaceId, creatorId: context.actorId },
          { client: trx }
        )
      const project = await Project.query({ client: trx })
        .where({ id, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      return project.merge(input).save()
    })
  }
}
