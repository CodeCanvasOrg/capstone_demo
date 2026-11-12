import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import DocumentIssue from '#models/document_issue'
import VersionService from '#services/documents/version_service'
import PublicationReviewService, {
  publicationFindings,
} from '#services/documents/publication_review_service'
import { account, reset } from '../helpers/workspaces.ts'

const t = (text: string) => ({ type: 'text', text })
const doc = (body: string) => ({
  type: 'doc' as const,
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [t('Title')] },
    { type: 'paragraph', content: [t('Summary.')] },
    { type: 'paragraph', content: [t(body)] },
  ],
})
const issues = (documentId: string) => DocumentIssue.query().where('documentId', documentId)

test.group('Publication review findings', (group) => {
  group.each.setup(reset)

  test('findings are pure, anchored and never edit or quote the content', ({ assert }) => {
    const content = doc('See /workspaces/0f8fad5b-d9cb/files/x [TODO check]')
    const before = JSON.stringify(content)
    const found = publicationFindings(content as any)
    assert.includeMembers(
      found.map((f) => f.code),
      ['private_route', 'reviewer_marker']
    )
    assert.equal(JSON.stringify(content), before)
  })

  test('save records one version-bound internal issue per finding; replays add none', async ({
    assert,
  }) => {
    const a = await account()
    const mutationId = randomUUID()
    const save = () =>
      new VersionService().save(a.context, a.document.id, {
        content: doc('Ready [TODO confirm numbers]'),
        baseVersionId: null,
        mutationId,
      })
    const version = await save()
    await save() // uncertain-save replay
    const rows = await issues(a.document.id)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].versionId, version.id)
    assert.equal(rows[0].code, 'publication_reviewer_marker')
    assert.isFalse(rows[0].blocking)
    assert.equal(rows[0].origin, 'ai')
    assert.notInclude(`${rows[0].title} ${rows[0].description}`, 'confirm numbers')
    assert.equal(
      await new PublicationReviewService().record(
        a.context,
        a.document.id,
        version.id,
        version.content as any
      ),
      0
    )
  })

  test('human issues survive; each version gets its own findings; clean saves record none', async ({
    assert,
  }) => {
    const a = await account()
    const versions = new VersionService()
    const first = await versions.save(a.context, a.document.id, {
      content: doc('Plain [TODO one]'),
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    await DocumentIssue.create({
      workspaceId: a.workspace.id,
      documentId: a.document.id,
      title: 'Human issue',
      blocking: false,
      state: 'open',
      origin: 'human',
      createdById: a.user.id,
      updatedById: a.user.id,
      revision: 0,
    } as any)
    const second = await versions.save(a.context, a.document.id, {
      content: doc('Plain [TODO two]'),
      baseVersionId: first.id,
      mutationId: randomUUID(),
    })
    await versions.save(a.context, a.document.id, {
      content: doc('Clean prose.'),
      baseVersionId: second.id,
      mutationId: randomUUID(),
    })
    const rows = await issues(a.document.id)
    assert.lengthOf(rows, 3)
    assert.isTrue(rows.some((r) => r.title === 'Human issue'))
    assert.sameMembers(
      rows.filter((r) => r.code).map((r) => r.versionId),
      [first.id, second.id]
    )
  })

  test('a failing check never fails the save', async ({ assert }) => {
    const a = await account()
    const original = PublicationReviewService.prototype.record
    PublicationReviewService.prototype.record = async () => {
      throw new Error('boom')
    }
    try {
      const version = await new VersionService().save(a.context, a.document.id, {
        content: doc('Fine'),
        baseVersionId: null,
        mutationId: randomUUID(),
      })
      assert.isOk(version.id)
    } finally {
      PublicationReviewService.prototype.record = original
    }
  })
})
