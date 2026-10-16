import VersionService from '#services/documents/version_service'
import LibraryService from '#services/files/library_service'
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { account, reset, source } from '../helpers/workspaces.ts'
import { INFORMATION_FIELDS } from '#services/documents/document_service'
import DocumentApproval from '#models/document_approval'
import DocumentIssue from '#models/document_issue'
import DocumentReview from '#models/document_review'
import WorkspaceMembership from '#models/workspace_membership'

test.group('Workspace HTTP workflow', (group) => {
  group.each.setup(reset)
  test('editor props, JSON save, review, approval and invalidation form one authorized workflow', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const root = `/workspaces/${a.workspace.id}/documents/${a.document.id}`
    const info = Object.fromEntries(INFORMATION_FIELDS.map((key) => [key, `Project ${key}`]))
    const input = await client
      .put(root)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        title: 'Transport verified',
        projectInformation: info,
        metadataRevision: 0,
        dueDate: '2026-12-20',
      })
    input.assertStatus(200)
    const saved = await client
      .post(`${root}/versions`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        baseVersionId: null,
        mutationId: randomUUID(),
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Saved through HTTP.' },
                { type: 'hardBreak' },
                { type: 'text', text: 'Second line.' },
              ],
            },
          ],
        },
      })
    saved.assertStatus(200)
    const versionId = saved.body().data.version.id
    const view = await client
      .get(`${root}/edit`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    view.assertStatus(200)
    assert.equal(view.body().props.workflow.readiness.percentage, 50)
    assert.equal(view.body().props.document.dueDate.slice(0, 10), '2026-12-20')
    assert.equal(view.body().props.workspace.id, a.workspace.id)
    assert.equal(view.body().props.recentDocuments[0].title, 'Transport verified')
    const reviewed = await client
      .post(`${root}/reviews`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ baseVersionId: versionId, mutationId: randomUUID() })
    reviewed.assertStatus(200)
    const review = await DocumentReview.firstOrFail()
    const approved = await client
      .post(`${root}/approvals`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        baseVersionId: versionId,
        reviewId: review.id,
        warningAcknowledgments: ['input-only'],
        mutationId: randomUUID(),
      })
    approved.assertStatus(200)
    const approval = await DocumentApproval.firstOrFail()
    assert.isNull(approval.invalidatedAt)
    const stale = await client
      .post(`${root}/versions`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        baseVersionId: null,
        mutationId: randomUUID(),
        content: { type: 'doc', content: [] },
      })
    stale.assertStatus(409)
    assert.equal(stale.body().error.code, 'E_WORKSPACE_CONFLICT')
    const issue = await client
      .post(`${root}/issues`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ title: 'Verify a claim', description: 'Needs evidence', blocking: true })
    issue.assertStatus(200)
    await approval.refresh()
    assert.isNotNull(approval.invalidatedAt)
    const record = await DocumentIssue.firstOrFail()
    const resolved = await client
      .patch(`${root}/issues/${record.id}`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ title: record.title, blocking: true, state: 'resolved', revision: record.revision })
    resolved.assertStatus(200)
    const denied = await client
      .post(`${root}/exports/pdf`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ approvalId: approval.id, mutationId: randomUUID() })
    denied.assertStatus(409)
  })
  test('members receive edit capability but never owner controls in editor props', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const b = await account('member@example.test')
    await WorkspaceMembership.create({
      workspaceId: a.workspace.id,
      userId: b.user.id,
      role: 'member',
      authorizationEpoch: 0,
    })
    const result = await client
      .get(`/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`)
      .loginAs(b.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    result.assertStatus(200)
    assert.deepEqual(result.body().props.document.capabilities, {
      edit: true,
      delete: false,
      approve: false,
    })
    assert.isFalse(result.body().props.workspaceCapabilities.manageMembers)
  })
})

test.group('Workspace deletion boundaries', (group) => {
  group.each.setup(reset)
  test('member deletion is denied and owner deletion preserves the shared files library', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const b = await account('collaborator@example.test')
    const evidence = await source(a)
    await WorkspaceMembership.create({
      workspaceId: a.workspace.id,
      userId: b.user.id,
      role: 'member',
      authorizationEpoch: 0,
    })
    const root = `/workspaces/${a.workspace.id}/documents/${a.document.id}`
    const denied = await client
      .delete(root)
      .loginAs(b.user)
      .withCsrfToken()
      .header('accept', 'application/json')
    denied.assertStatus(403)
    const removed = await client.delete(root).loginAs(a.user).withCsrfToken().redirects(0)
    removed.assertStatus(302)
    const { default: Document } = await import('#models/document')
    const { default: File } = await import('#models/file')
    assert.isNull(await Document.find(a.document.id))
    assert.isNotNull(await File.find(evidence.file.id))
  })
})

test.group('Unavailable evidence display', (group) => {
  group.each.setup(reset)
  test('removed evidence is hidden and explained when opening saved history', async ({
    client,
  }) => {
    const a = await account()
    const evidence = await source(a)
    await new VersionService().save(a.context, a.document.id, {
      mutationId: randomUUID(),
      baseVersionId: null,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Preserved writing' },
              { type: 'sourceCitation', attrs: { sourceChunkId: evidence.chunkId } },
            ],
          },
        ],
      },
    })
    await new LibraryService().change(a.context, evidence.file.id)
    const response = await client
      .get(`/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    response.assertStatus(200)
    response.assertBodyContains({ props: { unavailableEvidence: true } })
  })
})
