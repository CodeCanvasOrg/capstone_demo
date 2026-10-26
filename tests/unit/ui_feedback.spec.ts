import { test } from '@japa/runner'
import {
  requestJson as api,
  ApiError,
  feedbackError,
  responseError,
  safeMessage,
} from '../../shared/ui_feedback.ts'

test.group('UI feedback', () => {
  test('malformed error bodies cannot mask the original status', ({ assert }) => {
    for (const body of [null, 'html', { errors: {} }, { errors: [null, 3, { field: 42 }] }]) {
      const error = responseError(422, body)
      assert.instanceOf(error, ApiError)
      assert.equal(error.status, 422)
      assert.deepEqual(error.details, {})
    }
  })
  test('validation fields keep associations without rendering raw server strings', ({ assert }) => {
    const error = responseError(422, {
      errors: [
        { field: 'email', message: 'The email field must be a valid email address' },
        { field: 'projectInformation.overview', message: 'The overview field is required' },
        { field: '__proto__', message: 'secret stack trace' },
        { field: 'title', message: 'SELECT secret FROM users' },
      ],
    })
    assert.equal(error.details.email, 'Enter a valid email address.')
    assert.equal(error.details['projectInformation.overview'], 'This field is required.')
    assert.equal(error.details.title, 'Check this value.')
    assert.equal(Object.getPrototypeOf(error.details), Object.prototype)
    assert.notInclude(JSON.stringify(error.details), 'SELECT')
  })
  test('recovery is appropriate for sessions, permissions, conflicts and transient failures', ({
    assert,
  }) => {
    for (const status of [401, 403, 404, 409, 410, 413, 419, 422, 429, 500, 503]) {
      const error = responseError(status, {
        error: { message: 'SQL stack trace secret', code: 'E_TEST' },
      })
      assert.equal(error.status, status)
      assert.equal(error.retryable, status === 429 || status >= 500)
      assert.notInclude(error.message, 'SQL')
    }
    assert.include(responseError(401, null).message, 'Sign in')
    assert.include(responseError(403, null).message, 'permission')
  })
  test('source and approval conflicts preserve a specific recovery step', ({ assert }) => {
    const source = responseError(409, {
      error: {
        code: 'E_WORKSPACE_CONFLICT',
        message:
          'A selected source could not be prepared. Retry source preparation, then generate again.',
      },
    })
    const approval = responseError(409, {
      error: { message: 'Approve the exact current version before final export' },
    })
    assert.include(source.message, 'preparation')
    assert.include(approval.message, 'Approve')
    assert.notEqual(source.message, approval.message)
    assert.equal(safeMessage('provider secret', 'Draft failed.'), 'Draft failed.')
    assert.equal(safeMessage('__proto__', 'Draft failed.'), 'Draft failed.')
    assert.equal(safeMessage('constructor', 'Draft failed.'), 'Draft failed.')
    assert.equal(
      feedbackError(new Error('private response')).message,
      'This could not finish. Please try again.'
    )
  })
  test('transport preserves CSRF, method, payload and cancellation', async ({
    assert,
    cleanup,
  }) => {
    const oldFetch = globalThis.fetch
    cleanup(() => {
      globalThis.fetch = oldFetch
    })
    const controller = new AbortController()
    globalThis.fetch = async (_url, options) => {
      assert.equal(options?.method, 'POST')
      assert.equal(options?.credentials, 'same-origin')
      assert.equal((options?.headers as Record<string, string>)['X-XSRF-TOKEN'], 'hello world')
      assert.equal(options?.body, '{"mutationId":"same-intent"}')
      assert.equal(options?.signal, controller.signal)
      return Response.json({ data: { saved: true } })
    }
    assert.deepEqual(
      await api('/save', 'POST', { mutationId: 'same-intent' }, controller.signal, 'hello world'),
      {
        data: { saved: true },
      }
    )
    globalThis.fetch = async () => {
      throw new DOMException('Cancelled', 'AbortError')
    }
    await assert.rejects(() => api('/save'), 'Cancelled')
  })
  test('network and unreadable successful responses never invent an expired session', async ({
    assert,
    cleanup,
  }) => {
    const oldFetch = globalThis.fetch
    cleanup(() => {
      globalThis.fetch = oldFetch
    })
    for (const response of [
      new Response('<html>oops</html>'),
      new Response(null, { status: 204 }),
      Response.json(false),
      Response.json([]),
    ]) {
      globalThis.fetch = async () => response
      try {
        await api('/save')
        assert.fail('Must reject unreadable data')
      } catch (reason) {
        assert.instanceOf(reason, ApiError)
        assert.notEqual((reason as ApiError).status, 401)
        assert.equal((reason as ApiError).code, 'E_INVALID_RESPONSE')
      }
    }
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed')
    }
    try {
      await api('/save')
      assert.fail('Must reject network failure')
    } catch (reason) {
      assert.equal((reason as ApiError).status, 0)
      assert.isTrue((reason as ApiError).retryable)
    }
  })
  test('multipart transport keeps binary files and lets the browser set the boundary', async ({
    assert,
    cleanup,
  }) => {
    const oldFetch = globalThis.fetch
    cleanup(() => {
      globalThis.fetch = oldFetch
    })
    const data = new FormData()
    data.append(
      'file',
      new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' }),
      'photo.png'
    )
    globalThis.fetch = async (_url, options) => {
      assert.strictEqual(options?.body, data)
      assert.notProperty(options?.headers, 'Content-Type')
      assert.equal((options?.headers as Record<string, string>)['X-XSRF-TOKEN'], 'token')
      return Response.json({ data: { id: 'uploaded' } }, { status: 201 })
    }
    assert.deepEqual(await api('/images', 'POST', data, undefined, 'token'), {
      data: { id: 'uploaded' },
    })
  })
})
