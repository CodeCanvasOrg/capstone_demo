import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { account, reset } from '../helpers/workspaces.ts'
import DocumentService from '#services/documents/document_service'
import ProjectInformationService from '#services/documents/project_information_service'
import ReadinessService, { reviewInputHash } from '#services/documents/readiness_service'
import { generationInput } from '#services/documents/generation_service'
import { fingerprint } from '#services/workspaces/task_service'
import VersionService from '#services/documents/version_service'
import WorkflowService from '#services/documents/workflow_service'
import { informationFields, informationToContent } from '../../shared/project_information.ts'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
function richInformation(): TipTapDocument {
  const doc = informationToContent(
    Object.fromEntries(informationFields.map(([key]) => [key, `Actual ${key}`]))
  ) as TipTapDocument
  doc.content[0].content = [
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'A meaningful brief', marks: [{ type: 'bold' }] }],
            },
          ],
        },
      ],
    },
  ]
  return doc
}
test.group('Project information document', (group) => {
  group.each.setup(reset)
  test('scoped HTTP roundtrips derive trusted plain fields and reject stale or foreign writes', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const content = richInformation()
    const url = `/workspaces/${a.workspace.id}/documents/${a.document.id}`
    const save = await client
      .put(url)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({
        title: a.document.title,
        projectInformationContent: content,
        projectInformation: { overview: 'Forged alternate text' },
        metadataRevision: 0,
      })
    save.assertStatus(200)
    await a.document.refresh()
    assert.deepEqual(a.document.projectInformationContent, content)
    assert.equal(a.document.projectInformation.overview, 'A meaningful brief')
    assert.equal(a.document.projectInformation.results, 'Actual results')
    const ready = await new ReadinessService().inspect(a.document)
    assert.isTrue(ready.stages[0].complete)
    const view = await client
      .get(`${url}/edit`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    view.assertStatus(200)
    assert.deepEqual(view.body().props.document.projectInformationContent, content)
    const stale = await client
      .put(url)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ title: 'Stale', projectInformationContent: content, metadataRevision: 0 })
    stale.assertStatus(409)
    const b = await account('other@example.test')
    const denied = await client
      .put(`/workspaces/${b.workspace.id}/documents/${a.document.id}`)
      .loginAs(b.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ title: 'Wrong tenant', projectInformationContent: content, metadataRevision: 1 })
    denied.assertStatus(404)
  })
  test('legacy text is preserved; unchanged plain clients retain rich content and edits replace it', async ({
    assert,
  }) => {
    const a = await account()
    const service = new DocumentService()
    const legacy = { overview: 'Original\n\nSecond paragraph' }
    await service.update(a.context, a.document.id, {
      title: a.document.title,
      projectInformation: legacy,
      metadataRevision: 0,
    })
    await a.document.refresh()
    assert.isNull(a.document.projectInformationContent)
    const content = informationToContent(a.document.projectInformation) as TipTapDocument
    await service.update(a.context, a.document.id, {
      title: a.document.title,
      projectInformationContent: content,
      metadataRevision: 1,
    })
    await a.document.refresh()
    assert.equal(a.document.projectInformation.overview, legacy.overview)
    const incomplete = await new ReadinessService().inspect(a.document)
    assert.isFalse(incomplete.stages[0].complete)
    await service.update(a.context, a.document.id, {
      title: a.document.title,
      projectInformation: a.document.projectInformation,
      metadataRevision: 2,
    })
    await a.document.refresh()
    assert.deepEqual(a.document.projectInformationContent, content)
    await service.update(a.context, a.document.id, {
      title: a.document.title,
      projectInformation: { overview: 'Legacy edit' },
      metadataRevision: 3,
    })
    await a.document.refresh()
    assert.isNull(a.document.projectInformationContent)
    assert.equal(a.document.projectInformation.overview, 'Legacy edit')
  })
  test('invalid, unsafe or oversized bodies fail without updating metadata', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const original = richInformation()
    const badBodies = [
      [
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
      [{ type: 'image', attrs: { sourceChunkId: randomUUID() } }],
      [{ type: 'paragraph', content: [{ type: 'paragraph' }] }],
      [{ type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(20001) }] }],
    ]
    const invalid = badBodies.map((body) => {
      const doc = richInformation()
      doc.content[0].content = body
      return doc
    })
    invalid.push(
      { type: 'doc', content: original.content.slice(1) },
      { type: 'doc', content: [original.content[0], ...original.content.slice(0, 6)] }
    )
    for (const content of invalid) {
      const response = await client
        .put(`/workspaces/${a.workspace.id}/documents/${a.document.id}`)
        .loginAs(a.user)
        .withCsrfToken()
        .header('accept', 'application/json')
        .json({ title: a.document.title, projectInformationContent: content, metadataRevision: 0 })
      response.assertStatus(422)
    }
    await a.document.refresh()
    assert.equal(a.document.metadataRevision, 0)
    assert.isNull(a.document.projectInformationContent)
  })
  test('unchanged rich information preserves approval; formatting edits invalidate and fence generation', async ({
    assert,
  }) => {
    const a = await account()
    const content = richInformation()
    const service = new DocumentService()
    const doc = await service.create(
      a.context,
      { title: 'Rich context', sourceMode: 'input_only', projectInformationContent: content },
      []
    )
    const version = await new VersionService().save(a.context, doc.id, {
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved writing' }] }],
      },
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    const workflow = new WorkflowService()
    const review = await workflow.transition(a.context, doc.id, {
      baseVersionId: version.id,
      mutationId: randomUUID(),
    })
    const approval = await workflow.transition(
      a.context,
      doc.id,
      {
        baseVersionId: version.id,
        reviewId: String(review.reviewId),
        warningAcknowledgments: ['input-only'],
        mutationId: randomUUID(),
      },
      true
    )
    await doc.refresh()
    const hash = reviewInputHash(doc)
    const generationHash = fingerprint(generationInput(doc))
    await service.update(a.context, doc.id, {
      title: doc.title,
      projectInformationContent: content,
      dueDate: '2026-12-20',
      metadataRevision: doc.metadataRevision,
    })
    await doc.refresh()
    assert.equal(doc.activeReviewId, review.reviewId)
    assert.equal(doc.activeApprovalId, approval.approvalId)
    assert.equal(reviewInputHash(doc), hash)
    content.content[0].content![0].content![0].content![0].content![0].marks = [{ type: 'italic' }]
    await service.update(a.context, doc.id, {
      title: doc.title,
      projectInformationContent: content,
      metadataRevision: doc.metadataRevision,
    })
    await doc.refresh()
    assert.isNull(doc.activeReviewId)
    assert.isNull(doc.activeApprovalId)
    assert.notEqual(reviewInputHash(doc), hash)
    assert.notEqual(fingerprint(generationInput(doc)), generationHash)
    assert.equal(doc.projectInformation.overview, 'A meaningful brief')
    assert.equal(doc.status, 'edited')
  })
  test('safe links normalize; headings alone leave fields empty', ({ assert }) => {
    const doc = informationToContent({}) as TipTapDocument
    doc.content[0].content = [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Reference',
            marks: [{ type: 'link', attrs: { href: 'https://example.test', target: '_self' } }],
          },
        ],
      },
    ]
    const normalized = new ProjectInformationService().normalize(doc)
    assert.equal(normalized.projectInformation.overview, 'Reference')
    assert.equal(normalized.projectInformation.problemStatement, '')
    assert.deepEqual(
      normalized.projectInformationContent.content[0].content![0].content![0].marks,
      [
        {
          type: 'link',
          attrs: { href: 'https://example.test', target: '_blank', rel: 'noopener noreferrer' },
        },
      ]
    )
  })
})
