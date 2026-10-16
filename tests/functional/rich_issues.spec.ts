import { test } from '@japa/runner'
import { account, reset } from '../helpers/workspaces.ts'
import DocumentIssue from '#models/document_issue'
import IssueService from '#services/documents/issue_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
const body = (): TipTapDocument => ({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'What needs attention' }],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Confirm the result', marks: [{ type: 'bold' }] }],
            },
          ],
        },
      ],
    },
  ],
})
test.group('Rich issue documents', (group) => {
  group.each.setup(reset)
  test('HTTP create and edit persist formatted bodies and expose them in editor props', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const url = `/workspaces/${a.workspace.id}/documents/${a.document.id}`
    const content = body()
    const response = await client
      .post(`${url}/issues`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        title: 'Check the evidence',
        description: 'Untrusted alternate text',
        descriptionContent: content,
        blocking: false,
      })
    response.assertStatus(200)
    const issue = await DocumentIssue.findByOrFail('title', 'Check the evidence')
    assert.deepEqual(issue.descriptionContent, content)
    assert.equal(issue.description, 'What needs attention\nConfirm the result')
    const view = await client
      .get(`${url}/edit`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    view.assertStatus(200)
    assert.deepEqual(view.body().props.issues[0].descriptionContent, content)
    content.content[1].content![0].content![0].content![0].marks = [{ type: 'italic' }]
    const edit = await client
      .patch(`${url}/issues/${issue.id}`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        title: issue.title,
        descriptionContent: content,
        blocking: false,
        state: 'open',
        revision: 0,
      })
    edit.assertStatus(200)
    await issue.refresh()
    assert.deepEqual(issue.descriptionContent, content)
    assert.equal(issue.description, 'What needs attention\nConfirm the result')
    const stale = await client
      .patch(`${url}/issues/${issue.id}`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        title: 'Stale edit',
        descriptionContent: body(),
        blocking: false,
        state: 'open',
        revision: 0,
      })
    stale.assertStatus(409)
    const b = await account('other@example.test')
    const denied = await client
      .patch(`/workspaces/${b.workspace.id}/documents/${b.document.id}/issues/${issue.id}`)
      .loginAs(b.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        title: 'Foreign edit',
        descriptionContent: body(),
        blocking: false,
        state: 'open',
        revision: 1,
      })
    denied.assertStatus(404)
  })
  test('resolve/reopen and unchanged legacy text preserve rich bodies; plain edits clear old formatting', async ({
    assert,
  }) => {
    const a = await account()
    const service = new IssueService()
    const content = body()
    const issue = await service.save(a.context, a.document.id, {
      title: 'A rich issue',
      descriptionContent: content,
      blocking: false,
    })
    await service.save(
      a.context,
      a.document.id,
      { title: issue.title, blocking: false, state: 'resolved', revision: 0 },
      issue.id
    )
    await issue.refresh()
    assert.deepEqual(issue.descriptionContent, content)
    assert.equal(issue.description, 'What needs attention\nConfirm the result')
    assert.equal(issue.resolvedById, a.user.id)
    await service.save(
      a.context,
      a.document.id,
      {
        title: issue.title,
        description: issue.description,
        blocking: false,
        state: 'open',
        revision: 1,
      },
      issue.id
    )
    await issue.refresh()
    assert.deepEqual(issue.descriptionContent, content)
    assert.isNull(issue.resolvedAt)
    await service.save(
      a.context,
      a.document.id,
      {
        title: issue.title,
        description: 'Legacy text edit',
        blocking: false,
        state: 'open',
        revision: 2,
      },
      issue.id
    )
    await issue.refresh()
    assert.isNull(issue.descriptionContent)
    assert.equal(issue.description, 'Legacy text edit')
    const legacy = await service.save(a.context, a.document.id, {
      title: 'Old issue',
      description: 'Original\n\nSecond paragraph',
      blocking: true,
    })
    assert.isNull(legacy.descriptionContent)
    assert.equal(legacy.description, 'Original\n\nSecond paragraph')
    await service.save(
      a.context,
      a.document.id,
      {
        title: issue.title,
        descriptionContent: body(),
        blocking: false,
        state: 'open',
        revision: 3,
      },
      issue.id
    )
    await service.save(
      a.context,
      a.document.id,
      { title: issue.title, descriptionContent: null, blocking: false, state: 'open', revision: 4 },
      issue.id
    )
    await issue.refresh()
    assert.isNull(issue.descriptionContent)
    assert.equal(issue.description, 'What needs attention\nConfirm the result')
  })
  test('invalid, unsafe and oversized rich bodies are rejected before persistence', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const invalid = [
      false,
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'paragraph' }] }] },
      { type: 'doc', content: [{ type: 'image', attrs: { sourceChunkId: 'untrusted' } }] },
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Click',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      },
      {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(10001) }] }],
      },
    ]
    for (const descriptionContent of invalid) {
      const response = await client
        .post(`/workspaces/${a.workspace.id}/documents/${a.document.id}/issues`)
        .loginAs(a.user)
        .withCsrfToken()
        .header('accept', 'application/json')
        .json({ title: 'Rejected', descriptionContent, blocking: false })
      response.assertStatus(422)
    }
    assert.isNull(await DocumentIssue.findBy('title', 'Rejected'))
  })
})
