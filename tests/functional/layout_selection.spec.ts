/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { account, reset } from '../helpers/workspaces.ts'
import { INFORMATION_FIELDS } from '#services/documents/document_service'
import DocumentService from '#services/documents/document_service'
import VersionService from '#services/documents/version_service'
import WorkflowService from '#services/documents/workflow_service'
import DocumentExportService from '#services/exports/document_export_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import ExportPdfService from '#services/exports/pdf_service'
import AccessService from '#services/workspaces/access_service'
import WorkspaceMembership from '#models/workspace_membership'
import DocumentApproval from '#models/document_approval'

const body = (text: string) => ({
  type: 'doc' as const,
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Faster onboarding' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text }] },
  ],
})

/** A document with saved content, ready for review (same shape the review specs use). */
async function prepared(email?: string) {
  const a = await account(email)
  await new DocumentService().update(a.context, a.document.id, {
    title: a.document.title!,
    projectInformation: Object.fromEntries(INFORMATION_FIELDS.map((k) => [k, `Actual ${k}`])),
    metadataRevision: 0,
  })
  const version = await new VersionService().save(a.context, a.document.id, {
    content: body('Up to 30% faster (estimated).'),
    baseVersionId: null,
    mutationId: randomUUID(),
  })
  await a.document.refresh()
  return { ...a, version }
}

test.group('Document layout selection (TPL-02, TPL-05)', (group) => {
  group.each.setup(reset)
  const service = new LayoutSelectionService()

  test('a document without a saved selection resolves the standard preset and latest brand', async ({
    assert,
  }) => {
    const a = await account()
    const selection = await service.resolve(a.context, a.document.id)
    assert.equal(selection.templateId, 'case_study_standard')
    assert.equal(selection.brandId, 'humblebee')
    assert.isFalse(selection.saved)
    assert.equal(selection.revision, 0)
  })

  test('saving pins template and brand versions and bumps the revision', async ({ assert }) => {
    const a = await account()
    const saved = await service.save(a.context, a.document.id, {
      templateId: 'case_study_concise',
      options: { imageMode: 'without' },
      baseRevision: 0,
    })
    assert.equal(saved.templateVersion, 1)
    assert.equal(saved.brandVersion, 1)
    assert.equal(saved.revision, 1)
    assert.deepInclude(saved.options, { imageMode: 'without' })
    assert.equal((await service.resolve(a.context, a.document.id)).templateId, 'case_study_concise')
  })

  test('forged template ids, unsupported types and bad options are rejected', async ({
    assert,
  }) => {
    const a = await account()
    for (const input of [
      { templateId: '../../etc/passwd' },
      { templateId: 'research_brief' },
      { templateId: 'case_study_standard', options: { imageMode: 'sideways' } },
      { templateId: 'case_study_standard', templateVersion: 999 },
      { templateId: 'case_study_standard', brandVersion: 999 },
    ]) {
      await assert.rejects(
        () => service.save(a.context, a.document.id, { ...input, baseRevision: 0 } as never),
        /template|option|brand|version/i
      )
    }
    assert.isFalse((await service.resolve(a.context, a.document.id)).saved)
  })

  test('a stale base revision is a conflict and overwrites nothing', async ({ assert }) => {
    const a = await account()
    await service.save(a.context, a.document.id, {
      templateId: 'case_study_concise',
      baseRevision: 0,
    })
    await assert.rejects(
      () =>
        service.save(a.context, a.document.id, {
          templateId: 'case_study_standard',
          baseRevision: 0,
        }),
      /changed|conflict/i
    )
    assert.equal((await service.resolve(a.context, a.document.id)).templateId, 'case_study_concise')
  })

  test('changing the layout invalidates review and approval; a no-op save does not', async ({
    assert,
  }) => {
    const a = await prepared()
    const review = await new WorkflowService().transition(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    await a.document.refresh()
    assert.equal(a.document.activeReviewId, review.reviewId)

    // Saving what is already effective (the default) is a no-op.
    const same = await service.save(a.context, a.document.id, {
      templateId: 'case_study_standard',
      baseRevision: 0,
    })
    assert.equal(same.revision, 0, 'identical effective selection creates no revision')
    assert.isFalse(same.saved)
    await a.document.refresh()
    assert.equal(a.document.activeReviewId, review.reviewId)

    await service.save(a.context, a.document.id, {
      templateId: 'case_study_concise',
      baseRevision: 0,
    })
    await a.document.refresh()
    assert.isNull(a.document.activeReviewId)
    assert.equal(a.document.status, 'edited')

    // And repeating the new selection is again a no-op.
    const again = await service.save(a.context, a.document.id, {
      templateId: 'case_study_concise',
      baseRevision: 1,
    })
    assert.equal(again.revision, 1)
  })

  test('changing the layout writes an audit event with the actor', async ({ assert }) => {
    const a = await prepared()
    await new WorkflowService().transition(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    await service.save(a.context, a.document.id, {
      templateId: 'case_study_concise',
      baseRevision: 0,
    })
    const events = await db
      .from('workflow_events')
      .where({ document_id: a.document.id, operation: 'invalidate' })
    assert.isAbove(events.length, 0)
    assert.equal(events.at(-1).actor_id, a.user.id)
  })

  test('another workspace member without access cannot read or change the selection', async ({
    assert,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    await assert.rejects(() => service.resolve(b.context, a.document.id))
    await assert.rejects(() =>
      service.save(b.context, a.document.id, { templateId: 'case_study_concise', baseRevision: 0 })
    )
  })
})

test.group('Preview and export use the selected layout (RND-01, APR-01)', (group) => {
  group.each.setup(reset)
  const generate = ExportPdfService.generate
  group.each.teardown(() => {
    ExportPdfService.generate = generate
  })

  test('preview renders through the pinned template with the draft watermark', async ({
    assert,
  }) => {
    const a = await prepared()
    await new LayoutSelectionService().save(a.context, a.document.id, {
      templateId: 'case_study_concise',
      baseRevision: 0,
    })
    const html = (await new DocumentExportService().preview(
      a.context,
      a.document.id,
      'html'
    )) as string
    assert.include(html, 'data-template="case_study_concise"')
    assert.include(html, 'NOT APPROVED')
    assert.notMatch(html, /reviewerNotes|chunkId/)
  })

  test('approval records the review bundle hash; drift behind the service blocks export', async ({
    assert,
  }) => {
    const a = await prepared()
    // Solo workspaces export without approval; add a member so approval is required.
    const b = await account('bob@example.test')
    await WorkspaceMembership.create({
      workspaceId: a.workspace.id,
      userId: b.user.id,
      role: 'member',
      authorizationEpoch: 0,
    })
    await new LayoutSelectionService().save(a.context, a.document.id, {
      templateId: 'case_study_concise',
      baseRevision: 0,
    })
    const reviewer = (await new AccessService().resolve(b.user.id, a.workspace.id)).context
    const workflow = new WorkflowService()
    const review = await workflow.transition(a.context, a.document.id, {
      baseVersionId: a.version.id,
      mutationId: randomUUID(),
    })
    // Reviewer-required readiness needs an editorial check; approve as owner after acknowledgements.
    await a.document.refresh()
    const approved = await workflow.transition(
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
    void reviewer
    const approval = await DocumentApproval.findOrFail(String(approved.approvalId))
    assert.match(String((approval as any).bundleHash), /^[0-9a-f]{64}$/)

    ExportPdfService.generate = async () => Buffer.from('PDF')
    // Same bundle: export is accepted.
    await new DocumentExportService().request(a.context, a.document.id, {
      approvalId: approval.id,
      mutationId: randomUUID(),
    })
    // Bypass the service and change the pinned options: the approval no longer matches.
    await db
      .from('document_layouts')
      .where({ document_id: a.document.id })
      .update({ options: JSON.stringify({ imageMode: 'without' }) })
    await assert.rejects(
      () =>
        new DocumentExportService().request(a.context, a.document.id, {
          approvalId: approval.id,
          mutationId: randomUUID(),
        }),
      /approv|changed|stale/i
    )
  })
})
