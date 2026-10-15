import { test } from '@japa/runner'
import { account, reset } from '../helpers/workspaces.ts'
import IssueService from '#services/documents/issue_service'
import DocumentService from '#services/documents/document_service'
import Document from '#models/document'
import DocumentIssue from '#models/document_issue'
test.group('Workspace document metadata', (group) => {
  group.each.setup(reset)
  test('calendar deadlines persist without changing ownership and stale metadata is rejected', async ({
    assert,
  }) => {
    const a = await account()
    const service = new DocumentService()
    const doc = await service.update(a.context, a.document.id, {
      title: a.document.title!,
      dueDate: '2026-10-31',
      metadataRevision: 0,
    })
    assert.equal(doc.dueDate!.toISODate(), '2026-10-31')
    await assert.rejects(() =>
      service.update(a.context, doc.id, { title: 'stale', metadataRevision: 0 })
    )
    await assert.rejects(() =>
      service.update(a.context, doc.id, {
        title: 'bad calendar',
        dueDate: '2026-02-30',
        metadataRevision: 1,
      })
    )
  })
  test('issues preserve actor timestamps, require matching parent and reopen explicitly', async ({
    assert,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const service = new IssueService()
    await Document.query().where('id', a.document.id).update({ status: 'approved' })
    const issue = await service.save(a.context, a.document.id, {
      title: 'Verify result',
      blocking: true,
    })
    await a.document.refresh()
    assert.equal(a.document.status, 'edited')
    await assert.rejects(() =>
      service.save(
        b.context,
        b.document.id,
        { title: 'forged', blocking: false, state: 'resolved', revision: 0 },
        issue.id
      )
    )
    const resolved = await service.save(
      a.context,
      a.document.id,
      { title: issue.title, blocking: true, state: 'resolved', revision: 0 },
      issue.id
    )
    assert.equal(resolved.resolvedById, a.user.id)
    assert.isNotNull(resolved.resolvedAt)
    await assert.rejects(() =>
      service.save(
        a.context,
        a.document.id,
        { title: 'stale', blocking: false, state: 'open', revision: 0 },
        issue.id
      )
    )
    await service.save(
      a.context,
      a.document.id,
      { title: issue.title, blocking: false, state: 'open', revision: 1 },
      issue.id
    )
    const reopened = await DocumentIssue.findOrFail(issue.id)
    assert.isNull(reopened.resolvedAt)
    assert.isNull(reopened.resolvedById)
  })
})
