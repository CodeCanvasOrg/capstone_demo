import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { account, reset } from '../helpers/workspaces.ts'
import DocumentIssue from '#models/document_issue'
import VersionService from '#services/documents/version_service'
import ClaimReviewService from '#services/documents/claim_review_service'
import type ClaimEvaluationService from '#services/documents/claim_evaluation_service'

const cite = (id: string, text: string) => ({
  type: 'sourceCitation',
  attrs: { sourceChunkId: id, chunkText: text, fileName: 'report.pdf' },
})
const content = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Sales doubled.' }, cite('a', 'Sales +5%')],
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'Churn fell.' }, cite('b', 'Churn -3%')] },
  ],
}
const evaluator = (verdict: (text: string) => any) =>
  ({
    evaluate: async (input: any) => ({
      claimId: input.claimId,
      claimHash: `h-${input.text}`,
      evidenceHash: 'e',
      ...verdict(input.text),
    }),
  }) as unknown as ClaimEvaluationService

test.group('Generated claim review', (group) => {
  group.each.setup(reset)
  test('records a non-blocking AI issue for unsupported claims only, once', async ({ assert }) => {
    const a = await account()
    const version = await new VersionService().save(a.context, a.document.id, {
      baseVersionId: null,
      mutationId: randomUUID(),
      content,
    })
    const service = new ClaimReviewService(
      evaluator((text) =>
        text.startsWith('Sales')
          ? {
              status: 'evaluated',
              compliant: false,
              probability: 0.02,
              model: 'm',
            }
          : {
              status: 'evaluated',
              compliant: true,
              probability: 0.97,
              model: 'm',
            }
      )
    )
    assert.equal(await service.review(a.context, a.document.id, version.id, content), 1)
    assert.equal(await service.review(a.context, a.document.id, version.id, content), 0)
    const issues = await DocumentIssue.query().where('documentId', a.document.id)
    assert.lengthOf(issues, 1)
    assert.equal(issues[0].origin, 'ai')
    assert.equal(issues[0].code, 'unsupported_claim')
    assert.isFalse(issues[0].blocking)
    assert.equal(issues[0].versionId, version.id)
  })

  test('an unavailable check yields one review-manually issue, not a verdict', async ({
    assert,
  }) => {
    const a = await account()
    const version = await new VersionService().save(a.context, a.document.id, {
      baseVersionId: null,
      mutationId: randomUUID(),
      content,
    })
    const service = new ClaimReviewService(
      evaluator(() => ({ status: 'unable_to_evaluate', reason: 'timeout' }))
    )
    assert.equal(await service.review(a.context, a.document.id, version.id, content), 1)
    const [issue] = await DocumentIssue.query().where('documentId', a.document.id)
    assert.equal(issue.code, 'claim_check_unavailable')
  })
})
