import { test } from '@japa/runner'
import {
  PIPELINE_STAGES,
  StageTracker,
  checkpointKey,
  classifyFailure,
  runWithRetry,
} from '../../shared/ops/stages.ts'
import {
  PROVIDERS,
  checkProviderSettings,
  maskKey,
  redactSecrets,
} from '../../shared/ops/provider.ts'

test.group('Stage tracking (OPS-01A)', () => {
  test('exposes the named stages with no invented percentages', ({ assert }) => {
    assert.deepEqual(PIPELINE_STAGES, [
      'preparing',
      'retrieving',
      'drafting',
      'validating',
      'rendering',
      'ready_for_review',
    ])
    const tracker = new StageTracker(() => 0)
    assert.notProperty(tracker.snapshot(), 'percent')
  })

  test('records per-stage durations and safe error codes', ({ assert }) => {
    let now = 0
    const tracker = new StageTracker(() => now)
    tracker.start('preparing')
    now = 120
    tracker.start('drafting')
    now = 520
    tracker.fail('provider_timeout')
    const snap = tracker.snapshot()
    assert.equal(snap.stage, 'drafting')
    assert.equal(snap.status, 'failed')
    assert.deepEqual(snap.timings, { preparing: 120, drafting: 400 })
    assert.equal(snap.errorCode, 'provider_timeout')
  })

  test('snapshots round-trip so a refreshed UI retains task identity and status', ({ assert }) => {
    const tracker = new StageTracker(() => 5)
    tracker.start('retrieving')
    const restored = StageTracker.restore(tracker.snapshot(), () => 9)
    assert.equal(restored.snapshot().stage, 'retrieving')
  })

  test('unknown stages and error codes with unsafe text are rejected', ({ assert }) => {
    const tracker = new StageTracker(() => 0)
    assert.throws(() => tracker.start('banana' as never))
    assert.throws(() => tracker.fail('Bearer sk-secret-123 failed'))
  })
})

test.group('Retries and checkpoints (OPS-01B)', () => {
  const noWait = async () => {}

  test('transient provider failures retry with bounded exponential backoff', async ({ assert }) => {
    const waits: number[] = []
    let attempts = 0
    const result = await runWithRetry(
      async () => {
        attempts++
        if (attempts < 3) throw Object.assign(new Error('rate'), { status: 429 })
        return 'ok'
      },
      { maxAttempts: 4, baseMs: 100, sleep: async (ms) => void waits.push(ms) }
    )
    assert.equal(result.value, 'ok')
    assert.equal(result.attempts, 3)
    assert.deepEqual(waits, [100, 200])
  })

  test('invalid credentials are never retried', async ({ assert }) => {
    let attempts = 0
    await assert.rejects(() =>
      runWithRetry(
        async () => {
          attempts++
          throw Object.assign(new Error('bad key'), { status: 401 })
        },
        { maxAttempts: 5, sleep: noWait }
      )
    )
    assert.equal(attempts, 1)
    assert.equal(classifyFailure({ status: 401 }), 'auth')
    assert.equal(classifyFailure({ status: 503 }), 'transient')
    assert.equal(classifyFailure({ status: 400 }), 'permanent')
  })

  test('retry budget is bounded and persisted budgets are not reset', async ({ assert }) => {
    let attempts = 0
    const budget = { remaining: 2 }
    await assert.rejects(() =>
      runWithRetry(
        async () => {
          attempts++
          throw Object.assign(new Error('x'), { status: 503 })
        },
        { maxAttempts: 10, budget, sleep: noWait }
      )
    )
    assert.equal(attempts, 2)
    assert.equal(budget.remaining, 0)
    // A fresh run against the exhausted budget makes no call at all.
    await assert.rejects(() =>
      runWithRetry(async () => 'never', { maxAttempts: 3, budget, sleep: noWait })
    )
  })

  test('cancellation stops further attempts', async ({ assert }) => {
    const controller = new AbortController()
    let attempts = 0
    await assert.rejects(() =>
      runWithRetry(
        async () => {
          attempts++
          controller.abort()
          throw Object.assign(new Error('x'), { status: 503 })
        },
        { maxAttempts: 5, signal: controller.signal, sleep: noWait }
      )
    )
    assert.equal(attempts, 1)
  })

  test('checkpoint keys are idempotent and change when inputs change', ({ assert }) => {
    const a = checkpointKey({ collectionId: 'c1', entryId: 'e1', inputHash: 'h1' })
    assert.equal(a, checkpointKey({ inputHash: 'h1', entryId: 'e1', collectionId: 'c1' }))
    assert.notEqual(a, checkpointKey({ collectionId: 'c1', entryId: 'e1', inputHash: 'h2' }))
  })
})

test.group('Provider settings (OPS-02)', () => {
  test('keys are masked and never echoed', ({ assert }) => {
    assert.equal(maskKey('sk-or-v1-abcdef123456'), 'sk-o…3456')
    assert.equal(maskKey('short'), '••••')
    assert.equal(maskKey(''), '')
  })

  test('secrets are redacted from log text and nested payloads', ({ assert }) => {
    const text = redactSecrets('Authorization: Bearer sk-or-v1-abcdef123456 failed')
    assert.notInclude(text, 'abcdef123456')
    const payload = redactSecrets({ apiKey: 'sk-live-xyz', nested: { token: 'abc', ok: 1 } })
    assert.deepEqual(payload, { apiKey: '[redacted]', nested: { token: '[redacted]', ok: 1 } })
  })

  test('only allowlisted providers and endpoints are accepted', ({ assert }) => {
    assert.includeMembers(Object.keys(PROVIDERS), ['openrouter'])
    assert.isEmpty(
      checkProviderSettings({ provider: 'openrouter', apiKey: 'sk-or-v1-abcdef123456' })
    )
    assert.equal(
      checkProviderSettings({ provider: 'mystery', apiKey: 'x'.repeat(20) })[0].code,
      'unsupported_provider'
    )
    assert.equal(
      checkProviderSettings({
        provider: 'openrouter',
        apiKey: 'sk-or-v1-abcdef123456',
        endpoint: 'https://evil.test/v1',
      })[0].code,
      'endpoint_not_allowed'
    )
    assert.equal(
      checkProviderSettings({ provider: 'openrouter', apiKey: '' })[0].code,
      'key_missing'
    )
  })

  test('providers are explicit; no silent fallback is configured', ({ assert }) => {
    for (const provider of Object.values(PROVIDERS)) assert.notProperty(provider, 'fallback')
  })
})
