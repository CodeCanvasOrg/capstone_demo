import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { Exception } from '@adonisjs/core/exceptions'
import File from '#models/file'
import Project from '#models/project'
import SourceScopeService, { names } from '#services/files/source_scope_service'
import AccessService, {
  conflict,
  missingResource,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'

export type ProjectLinkChange = 'attach' | 'detach'

export default class ProjectFilesService {
  attach(context: WorkspaceAccessContext, fileId: string, projectId: string) {
    return this.change(context, fileId, projectId, 'attach')
  }

  detach(context: WorkspaceAccessContext, fileId: string, projectId: string) {
    return this.change(context, fileId, projectId, 'detach')
  }

  /**
   * Links or unlinks one file and one project. `actorId` is the person making
   * the change; null is an operator (Ace command) and skips the owner check.
   * Returns false when the link was already in the requested state.
   */
  async link(
    trx: TransactionClientContract,
    workspaceId: string,
    fileId: string,
    projectId: string,
    change: ProjectLinkChange,
    actorId: number | null
  ) {
    const file = await File.query({ client: trx })
      .where({ id: fileId, workspaceId })
      .forUpdate()
      .first()
    if (!file) throw missingResource()
    if (actorId !== null && file.userId !== actorId)
      throw new Exception('Only the uploading owner manages this file', { status: 403 })
    const project = await Project.query({ client: trx })
      .where({ id: projectId, workspaceId })
      .first()
    if (!project) throw missingResource()
    const rows = await trx
      .from('project_files')
      .where({ workspace_id: workspaceId, file_id: fileId })
      .select('project_id')
    const current = rows.map((row) => row.project_id as string)
    const linked = current.includes(projectId)
    if (linked === (change === 'attach')) return false
    const next =
      change === 'attach' ? [...current, projectId] : current.filter((id) => id !== projectId)
    const blocked = await new SourceScopeService().conflicts(trx, workspaceId, fileId, next)
    if (blocked.length)
      throw conflict(
        `This file is used by case studies outside its projects: ${names(blocked.map((document) => document.title))}. Remove it from them first.`
      )
    if (change === 'attach')
      await trx.table('project_files').insert({
        workspace_id: workspaceId,
        project_id: projectId,
        file_id: fileId,
        created_by: actorId,
      })
    else
      await trx
        .from('project_files')
        .where({ workspace_id: workspaceId, project_id: projectId, file_id: fileId })
        .delete()
    return true
  }

  /** Selected sources that break the project rule (should always be empty). */
  async violations(workspaceId?: string) {
    const rows = await db.rawQuery(
      `SELECT df.workspace_id, df.document_id, df.files_id AS file_id, d.project_id AS document_project_id,
         array_agg(pf.project_id ORDER BY pf.project_id) AS file_project_ids
       FROM document_files df
       JOIN documents d ON d.id = df.document_id AND d.workspace_id = df.workspace_id
       JOIN project_files pf ON pf.file_id = df.files_id AND pf.workspace_id = df.workspace_id
       WHERE (?::uuid IS NULL OR df.workspace_id = ?::uuid)
       GROUP BY df.workspace_id, df.document_id, df.files_id, d.project_id
       HAVING NOT (d.project_id IS NOT NULL AND d.project_id = ANY(array_agg(pf.project_id)))
       ORDER BY df.workspace_id, df.document_id, df.files_id`,
      [workspaceId ?? null, workspaceId ?? null]
    )
    return rows.rows.map((row: Record<string, unknown>) => ({
      workspaceId: row.workspace_id as string,
      documentId: row.document_id as string,
      fileId: row.file_id as string,
      documentProjectId: row.document_project_id as string | null,
      fileProjectIds: row.file_project_ids as string[],
    }))
  }

  private change(
    context: WorkspaceAccessContext,
    fileId: string,
    projectId: string,
    change: ProjectLinkChange
  ) {
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      return this.link(trx, context.workspaceId, fileId, projectId, change, context.actorId)
    })
  }
}
