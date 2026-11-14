import { test } from '@japa/runner'
import ClaimEvaluationService from '#services/documents/claim_evaluation_service'
import claimEvaluationConfig from '#config/claim_evaluation'

const input = {
  claimId: 'c1',
  text: 'Latency fell by up to 40%',
  evidence: [{ id: 'e1', text: 'p95 latency dropped 38%.' }],
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const answer = (noul: unknown) => ({
  id: 'gen-dec-1',
  model: 'typesafe/jev-1.13-20260917',
  answers: { compliant: { type: 'noul', noul } },
})

test.group('ClaimEvaluationService', () => {
  test('returns a boolean compliance result and the resolved model', async ({ assert }) => {
    let sent: any
    const service = new ClaimEvaluationService(claimEvaluationConfig, async (_url, init) => {
      sent = JSON.parse(String(init?.body))
      return json(answer(0.9))
    })
    const result = await service.evaluate(input)
    assert.equal(sent.model, 'typesafe/jev-1.13')
    assert.equal(sent.questions.compliant.type, 'noul')
    assert.equal(result.status, 'evaluated')
    if (result.status === 'evaluated') {
      assert.isTrue(result.compliant)
      assert.equal(result.model, 'typesafe/jev-1.13-20260917')
      assert.equal(result.probability, 0.9)
    }
  })

  test('a low probability is not compliant', async ({ assert }) => {
    const service = new ClaimEvaluationService(claimEvaluationConfig, async () => json(answer(0.1)))
    const result = await service.evaluate(input)
    assert.equal(result.status === 'evaluated' && result.compliant, false)
  })

  test('missing evidence is decided without calling the model', async ({ assert }) => {
    const service = new ClaimEvaluationService(claimEvaluationConfig, async () => {
      throw new Error('must not be called')
    })
    const result = await service.evaluate({ ...input, evidence: [] })
    assert.equal(result.status, 'missing_evidence')
  })

  test('provider failures are unable_to_evaluate, never supported', async ({ assert }) => {
    const cases: Array<[() => Promise<Response>, string]> = [
      [async () => json({}, 429), 'rate_limited'],
      [async () => json({}, 503), 'http_503'],
      [async () => json({ model: 'typesafe/jev-1.13', answers: {} }), 'malformed_result'],
      [async () => json(answer('maybe')), 'malformed_result'],
      [
        async () => {
          throw Object.assign(new Error('t'), { name: 'TimeoutError' })
        },
        'timeout',
      ],
    ]
    for (const [http, reason] of cases) {
      const result = await new ClaimEvaluationService(claimEvaluationConfig, http).evaluate(input)
      assert.equal(result.status, 'unable_to_evaluate')
      if (result.status === 'unable_to_evaluate') assert.equal(result.reason, reason)
    }
  })

  test('stale claim, evidence or evaluator cannot be treated as current', async ({ assert }) => {
    const service = new ClaimEvaluationService(claimEvaluationConfig, async () => json(answer(0.9)))
    const result = await service.evaluate(input)
    assert.isTrue(service.isCurrent(result, input))
    assert.isFalse(service.isCurrent(result, { ...input, text: 'Latency fell by up to 50%' }))
    assert.isFalse(
      service.isCurrent(result, { ...input, evidence: [{ id: 'e1', text: 'changed' }] })
    )
    if (result.status === 'evaluated')
      assert.isFalse(service.isCurrent({ ...result, model: 'other/model' }, input))
  })
})
