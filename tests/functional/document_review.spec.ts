import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { account, reset, source } from '../helpers/workspaces.ts'
import { INFORMATION_FIELDS } from '#services/documents/document_service'
import DocumentService from '#services/documents/document_service'
import VersionService from '#services/documents/version_service'
import WorkflowService from '#services/documents/workflow_service'
import ReadinessService from '#services/documents/readiness_service'
import IssueService from '#services/documents/issue_service'
import DocumentApproval from '#models/document_approval'
import WorkspaceMembership from '#models/workspace_membership'
import AccessService from '#services/workspaces/access_service'
const content = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
})
export async function prepared() {
  const a = await account()
  const info = Object.fromEntries(INFORMATION_FIELDS.map((key) => [key, `Actual ${key}`]))
  await new DocumentService().update(a.context, a.document.id, {
    title: a.document.title!,
    projectInformation: info,
    metadataRevision: 0,
  })
  const version = await new VersionService().save(a.context, a.document.id, {
    content: content('A saved case study'),
    baseVersionId: null,
    mutationId: randomUUID(),
  })
  await a.document.refresh()
  return { ...a, version, info }
}
test.group('Exact-version review and approval', (group) => {
  group.each.setup(reset)
  test('readiness explains each quarter, and approval is exact, audited and owner-only', async ({
    assert,
  }) => {
    const a = await prepared()
    const b = await account('bob@example.test')
    const service = new WorkflowService()
    let state = await new ReadinessService().inspect(a.document)
    assert.equal(state.percentage, 50)
    assert.isTrue(state.canSubmit)
    assert.isFalse(state.stages[2].complete)
    const input = { baseVersionId: a.version.id, mutationId: randomUUID() }
    const review = await service.transition(a.context, a.document.id, input)
    const replay = await service.transition(a.context, a.document.id, input)
    assert.deepEqual(review, replay)
    await a.document.refresh()
    state = await new ReadinessService().inspect(a.document)
    assert.equal(state.percentage, 75)
    await WorkspaceMembership.create({
      workspaceId: a.workspace.id,
      userId: b.user.id,
      role: 'member',
      authorizationEpoch: 0,
    })
    const access = await new AccessService().resolve(b.user.id, a.workspace.id)
    const bob = access.context
    await assert.rejects(() =>
      service.transition(
        bob,
        a.document.id,
        {
          baseVersionId: a.version.id,
          reviewId: String(review.reviewId),
          mutationId: randomUUID(),
          warningAcknowledgments: ['input-only'],
        },
        true
      )
    )
    await assert.rejects(() =>
      service.transition(
        a.context,
        a.document.id,
        {
          baseVersionId: a.version.id,
          reviewId: String(review.reviewId),
          mutationId: randomUUID(),
          warningAcknowledgments: [],
        },
        true
      )
    )
    const result = await service.transition(
      a.context,
      a.document.id,
      {
        baseVersionId: a.version.id,
        reviewId: String(review.reviewId),
        mutationId: randomUUID(),
        warningAcknowledgments: ['input-only'],
      },
      true
    )
    const approval = await DocumentApproval.findOrFail(String(result.approvalId))
    assert.equal(approval.approvedById, a.user.id)
    assert.equal(approval.versionId, a.version.id)
    await a.document.refresh()
    state = await new ReadinessService().inspect(a.document)
    assert.equal(state.percentage, 100)
    assert.isTrue(state.approved)
  })
  test('deadline-only writes preserve approval; content and blocking issues invalidate it', async ({
    assert,
  }) => {
    const a = await prepared()
    const service = new WorkflowService()
    const review = await service.transition(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    const approved = await service.transition(
      a.context,
      a.document.id,
      {
        baseVersionId: a.version.id,
        reviewId: String(review.reviewId),
        mutationId: randomUUID(),
        warningAcknowledgments: ['input-only'],
      },
      true
    )
    await new DocumentService().update(a.context, a.document.id, {
      title: a.document.title!,
      projectInformation: a.info,
      dueDate: '2026-11-01',
      metadataRevision: 1,
    })
    await a.document.refresh()
    const retained = await new ReadinessService().inspect(a.document)
    assert.isTrue(retained.approved)
    await new IssueService().save(a.context, a.document.id, {
      title: 'Verify the result',
      blocking: true,
    })
    await a.document.refresh()
    assert.isNull(a.document.activeApprovalId)
    const history = await DocumentApproval.findOrFail(String(approved.approvalId))
    assert.isNotNull(history.invalidatedAt)
    await assert.rejects(() =>
      service.transition(
        a.context,
        a.document.id,
        {
          baseVersionId: a.version.id,
          reviewId: String(review.reviewId),
          mutationId: randomUUID(),
          warningAcknowledgments: ['input-only'],
        },
        true
      )
    )
    await new VersionService().save(a.context, a.document.id, {
      content: content('Changed wording'),
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    await a.document.refresh()
    assert.equal(a.document.status, 'edited')
  })
  test('source pins remain exact after JSONB persistence', async ({ assert }) => {
    const a = await prepared()
    const asset = await source(a)
    await a.document.refresh()
    const review = await new WorkflowService().transition(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    await a.document.refresh()
    const state = await new ReadinessService().inspect(a.document)
    assert.isTrue(state.stages[2].complete)
    assert.equal(state.pins[0].runId, asset.pin.runId)
    await new WorkflowService().transition(
      a.context,
      a.document.id,
      {
        baseVersionId: a.version.id,
        reviewId: String(review.reviewId),
        mutationId: randomUUID(),
        warningAcknowledgments: [],
      },
      true
    )
  })
  test('a no-op save has a durable replay identity even after later edits', async ({ assert }) => {
    const a = await prepared()
    const service = new VersionService()
    const mutationId = randomUUID()
    const saved = await service.save(a.context, a.document.id, {
      content: a.version.content,
      baseVersionId: a.version.id,
      mutationId,
    })
    assert.equal(saved.id, a.version.id)
    await service.save(a.context, a.document.id, {
      content: content('Later text'),
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    const retry = await service.save(a.context, a.document.id, {
      content: a.version.content,
      baseVersionId: a.version.id,
      mutationId,
    })
    assert.equal(retry.id, a.version.id)
  })
})
