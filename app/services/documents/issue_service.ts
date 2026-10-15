import WorkflowService from '#services/documents/workflow_service'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Document from '#models/document'
import DocumentIssue from '#models/document_issue'
import AccessService, {
  conflict,
  missingResource,
  uuid,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
export default class IssueService {
  async save(
    context: WorkspaceAccessContext,
    documentId: string,
    input: {
      title: string
      description?: string | null
      blocking: boolean
      state?: 'open' | 'resolved'
      revision?: number
    },
    issueId?: string
  ) {
    if (issueId && !uuid(issueId)) throw missingResource()
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const document = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      const existing = issueId
        ? await DocumentIssue.query({ client: trx })
            .where({ id: issueId, documentId, workspaceId: context.workspaceId })
            .forUpdate()
            .firstOrFail()
        : null
      if (existing && existing.revision !== input.revision)
        throw conflict('This issue changed. Reload it before retrying.')
      const state = input.state ?? 'open'
      const fields = {
        title: input.title,
        description: input.description ?? null,
        blocking: input.blocking,
        state,
        updatedById: context.actorId,
        resolvedAt: state === 'resolved' ? (existing?.resolvedAt ?? DateTime.utc()) : null,
        resolvedById: state === 'resolved' ? (existing?.resolvedById ?? context.actorId) : null,
        revision: existing ? existing.revision + 1 : 0,
      }
      const issue = existing
        ? await existing.merge(fields).save()
        : await DocumentIssue.create(
            {
              ...fields,
              workspaceId: context.workspaceId,
              documentId,
              createdById: context.actorId,
            },
            { client: trx }
          )
      if (
        issue.blocking &&
        issue.state === 'open' &&
        ['approved', 'in_review'].includes(document.status ?? '')
      ) {
        await new WorkflowService().invalidate(
          document,
          context.actorId,
          'An open blocking issue was recorded',
          trx
        )
        document.status = 'edited'
        await document.save()
      }
      return issue
    })
  }
}
