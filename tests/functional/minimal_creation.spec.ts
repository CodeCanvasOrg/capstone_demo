import { randomUUID } from 'node:crypto'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import DocumentService, { INFORMATION_FIELDS } from '#services/documents/document_service'
import VersionService from '#services/documents/version_service'
import WorkflowService from '#services/documents/workflow_service'
import { test } from '@japa/runner'
import { account, reset, source } from '../helpers/workspaces.ts'
import Project from '#models/project'
import ProjectService from '#services/workspaces/project_service'
import Document from '#models/document'
const rich = (text: string): TipTapDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'bold' }] }] }],
})

test.group('Minimal creation contracts', (group) => {
  group.each.setup(reset)
  test('project dialog persists formatting and derives the plain description', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const response = await client
      .post(`/workspaces/${a.workspace.id}/projects`)
      .loginAs(a.user)
      .withCsrfToken()
      .redirects(0)
      .json({
        name: 'A focused project',
        description: 'Untrusted alternate plain text',
        descriptionContent: rich('Formatted project brief'),
      })
    response.assertStatus(302)
    const project = await Project.findByOrFail('name', 'A focused project')
    assert.equal(project.description, 'Formatted project brief')
    assert.deepEqual(project.descriptionContent, rich('Formatted project brief'))
    const view = await client
      .get(`/workspaces/${a.workspace.id}/projects/${project.id}`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    view.assertStatus(200)
    assert.deepEqual(view.body().props.project.descriptionContent, rich('Formatted project brief'))
    const rejected = await client
      .post(`/workspaces/${a.workspace.id}/projects`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        name: 'Unsafe',
        descriptionContent: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'click',
                  marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
                },
              ],
            },
          ],
        },
      })
    rejected.assertStatus(422)
    assert.isNull(await Project.findBy('name', 'Unsafe'))
  })
  test('project creation context is preselected only after workspace authorization', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const b = await account('other@example.test')
    const project = await new ProjectService().save(a.context, { name: 'Current project' })
    const foreign = await new ProjectService().save(b.context, { name: 'Other project' })
    const base = `/workspaces/${a.workspace.id}/documents/create`
    const view = await client
      .get(`${base}?projectId=${project.id}`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    view.assertStatus(200)
    assert.equal(view.body().props.initialProjectId, project.id)
    const denied = await client
      .get(`${base}?projectId=${foreign.id}`)
      .loginAs(a.user)
      .header('accept', 'application/json')
    denied.assertStatus(404)
  })
  test('a conversational brief creates a rich draft with project context and selected library evidence', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const evidence = await source(a, false)
    const project = await new ProjectService().save(a.context, { name: 'Delivery' })
    const response = await client
      .post(`/workspaces/${a.workspace.id}/documents`)
      .loginAs(a.user)
      .withCsrfToken()
      .redirects(0)
      .json({
        title: 'The work we delivered',
        descriptionContent: rich('A brief from the conversation'),
        projectId: project.id,
        sourceMode: 'files',
        projectInformation: { overview: 'A brief from the conversation' },
        files: [{ id: evidence.file.id }],
      })
    response.assertStatus(302)
    const document = await Document.findByOrFail('title', 'The work we delivered')
    assert.equal(document.projectId, project.id)
    assert.equal(document.description, 'A brief from the conversation')
    assert.deepEqual(document.descriptionContent, rich('A brief from the conversation'))
    const attached = await document.related('files').query()
    assert.deepEqual(
      attached.map((file) => file.id),
      [evidence.file.id]
    )
    assert.equal(document.projectInformation.overview, 'A brief from the conversation')
    const rejected = await client
      .post(`/workspaces/${a.workspace.id}/documents`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        title: 'Rejected embedded evidence',
        descriptionContent: {
          type: 'doc',
          content: [{ type: 'image', attrs: { sourceChunkId: evidence.chunkId } }],
        },
      })
    rejected.assertStatus(422)
  })
  test('rich description roundtrips preserve a current review until the formatting actually changes', async ({
    assert,
  }) => {
    const a = await account()
    const service = new DocumentService()
    const doc = await service.create(
      a.context,
      {
        title: 'Formatting review',
        descriptionContent: rich('Same words'),
        sourceMode: 'input_only',
        projectInformation: Object.fromEntries(
          INFORMATION_FIELDS.map((key) => [key, 'Actual context'])
        ),
      },
      []
    )
    const version = await new VersionService().save(a.context, doc.id, {
      content: rich('Saved writing'),
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    await new WorkflowService().transition(a.context, doc.id, {
      baseVersionId: version.id,
      mutationId: randomUUID(),
    })
    await doc.refresh()
    const reviewId = doc.activeReviewId
    await service.update(a.context, doc.id, {
      title: doc.title,
      descriptionContent: rich('Same words'),
      metadataRevision: doc.metadataRevision,
      dueDate: '2026-12-20',
    })
    await doc.refresh()
    assert.equal(doc.activeReviewId, reviewId)
    const changed = rich('Same words')
    changed.content[0].content![0].marks = [{ type: 'italic' }]
    await service.update(a.context, doc.id, {
      title: doc.title,
      descriptionContent: changed,
      metadataRevision: doc.metadataRevision,
    })
    await doc.refresh()
    assert.isNull(doc.activeReviewId)
  })
})
