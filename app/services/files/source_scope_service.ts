import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import Document from '#models/document'
import File from '#models/file'
import { conflict } from '#services/workspaces/access_service'

/**
 * A case study may select workspace files (linked to no project) and files
 * linked to its own project. The database trigger
 * `enforce_project_source_scope` backs this rule at commit time.
 */
export default class SourceScopeService {
  eligible(query: ModelQueryBuilderContract<typeof File>, projectId: string | null) {
    return query.where((scope) => {
      scope.whereNotExists((links) =>
        links
          .from('project_files')
          .whereColumn('project_files.file_id', 'files.id')
          .whereColumn('project_files.workspace_id', 'files.workspace_id')
      )
      if (projectId)
        scope.orWhereExists((links) =>
          links
            .from('project_files')
            .whereColumn('project_files.file_id', 'files.id')
            .whereColumn('project_files.workspace_id', 'files.workspace_id')
            .where('project_files.project_id', projectId)
        )
    })
  }

  async ineligible(
    client: QueryClientContract,
    workspaceId: string,
    fileIds: string[],
    projectId: string | null
  ) {
    if (!fileIds.length) return []
    const allowed = await this.eligible(
      File.query({ client }).where('workspaceId', workspaceId).whereIn('id', fileIds),
      projectId
    ).select('id')
    const ids = new Set(allowed.map((file) => file.id))
    return File.query({ client })
      .where('workspaceId', workspaceId)
      .whereIn(
        'id',
        fileIds.filter((id) => !ids.has(id))
      )
      .orderBy('filename')
  }

  async assertSelectable(
    client: QueryClientContract,
    workspaceId: string,
    fileIds: string[],
    projectId: string | null
  ) {
    const blocked = await this.ineligible(client, workspaceId, fileIds, projectId)
    if (blocked.length)
      throw conflict(
        `These sources belong to another project: ${names(blocked.map((file) => file.filename))}. Choose workspace files or files from this case study's project.`
      )
  }

  /** Case studies that could no longer use the file if it were linked to exactly `projectIds`. */
  async conflicts(
    client: QueryClientContract,
    workspaceId: string,
    fileId: string,
    projectIds: string[]
  ) {
    if (!projectIds.length) return []
    return Document.query({ client })
      .where('workspaceId', workspaceId)
      .whereIn('id', (linked) =>
        linked
          .from('document_files')
          .where({ workspace_id: workspaceId, files_id: fileId })
          .select('document_id')
      )
      .where((scope) => scope.whereNull('projectId').orWhereNotIn('projectId', projectIds))
      .orderBy('title')
  }
}

export function names(values: (string | null)[]) {
  const shown = values.slice(0, 3).map((value) => value || 'Untitled')
  return values.length > 3 ? `${shown.join(', ')} and ${values.length - 3} more` : shown.join(', ')
}
