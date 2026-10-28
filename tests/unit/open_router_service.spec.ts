import { test } from '@japa/runner'
import { RunnableLambda } from '@langchain/core/runnables'

import openRouterApiConfig from '#config/open_router'
import OpenRouterService from '#services/open_router_service'

type TestableOpenRouterService = {
  model: { model: string; apiKey: string }
  structuredModel: { invoke: (input: unknown) => Promise<unknown> }
  embeddService: {
    similaritySearch: (
      query: string,
      vectors: number[][]
    ) => Promise<Array<{ index: number; similarity: number }>>
  }
  generateDocumentInit: (title: string, description: string, chunks?: unknown[]) => Promise<unknown>
}

const EXPECTED_DOCUMENT = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Generated content' }] }],
}

test.group('OpenRouterService', () => {
  test('is constructed with the configured OpenRouter model and API key', ({ assert }) => {
    const service = new OpenRouterService() as unknown as TestableOpenRouterService

    assert.equal(service.model.model, openRouterApiConfig.model)
    assert.equal(service.model.apiKey, openRouterApiConfig.apiKey.release())
  })

  test('returns the structured document produced by the model', async ({ assert }) => {
    const service = new OpenRouterService() as unknown as TestableOpenRouterService
    let invoked = false

    service.structuredModel = RunnableLambda.from(() => {
      invoked = true
      return EXPECTED_DOCUMENT
    })

    const result = await service.generateDocumentInit('Test Title', 'Test description')

    assert.isTrue(invoked)
    assert.deepEqual(result, EXPECTED_DOCUMENT)
  })

  test('sends retrieved image chunks to the model and hydrates trusted source metadata', async ({
    assert,
  }) => {
    const service = new OpenRouterService() as unknown as TestableOpenRouterService
    const chunk = {
      id: 'image-chunk-1',
      chunkIndex: 0,
      content: 'A chart showing customer growth.',
      embedding: [0.1, 0.2],
      fileKey: 'processed/chart.png',
      modelFileUrl: 'data:image/jpeg;base64,cHJldmlldw==',
      fileName: 'growth-report.pdf',
      fileUrl: 'https://files.example.test/chart.png',
      mediaType: 'image/png',
      pageNumber: 3,
    }
    service.embeddService.similaritySearch = async () => [{ index: 0, similarity: 0.9 }]

    let capturedMessages: any
    service.structuredModel = RunnableLambda.from((input) => {
      capturedMessages = input
      return {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Customer growth increased.' },
              { type: 'sourceCitation', attrs: { sourceChunkId: chunk.id } },
            ],
          },
          {
            type: 'image',
            attrs: { sourceChunkId: chunk.id, src: 'https://invalid.test/image.png' },
          },
        ],
      }
    }) as unknown as TestableOpenRouterService['structuredModel']

    const result = (await service.generateDocumentInit('Growth', 'Show customer growth', [
      chunk,
    ])) as any
    const humanContent = capturedMessages[1].content as Array<any>
    const imageBlock = humanContent.find((block) => block.type === 'image_url')
    const citation = result.content[0].content[1]
    const image = result.content[1]

    assert.equal(imageBlock.image_url.url, chunk.modelFileUrl)
    assert.include(humanContent[0].text, chunk.id)
    assert.equal(citation.attrs.chunkText, chunk.content)
    assert.equal(citation.attrs.fileName, chunk.fileName)
    assert.equal(citation.attrs.fileUrl, chunk.fileUrl)
    assert.equal(image.attrs.src, chunk.fileUrl)
    assert.equal(image.attrs.sourceChunkId, chunk.id)
  })
})

type Retrying = {
  runGeneration: (
    chain: unknown,
    input: unknown,
    guard?: () => Promise<void>,
    options?: { timeoutMs?: number; label?: string }
  ) => Promise<unknown>
}
const timeoutError = () =>
  new DOMException('The operation was aborted due to timeout', 'TimeoutError')

test.group('OpenRouterService | deadlines and retries', () => {
  test('a timed-out call gets one more full deadline, then succeeds', async ({ assert }) => {
    const signals: AbortSignal[] = []
    let calls = 0
    const chain = RunnableLambda.from(async (_input: unknown, options) => {
      signals.push(options!.signal!)
      if (++calls === 1) throw timeoutError()
      return EXPECTED_DOCUMENT
    })
    const service = new OpenRouterService() as unknown as Retrying
    assert.deepEqual(await service.runGeneration(chain, {}), EXPECTED_DOCUMENT)
    assert.equal(calls, 2)
    assert.equal(openRouterApiConfig.timeoutMs, 180_000)
  })

  test('a second timeout is not retried in-call; the task retry takes over', async ({ assert }) => {
    let calls = 0
    const chain = RunnableLambda.from(async () => {
      calls++
      throw timeoutError()
    })
    const service = new OpenRouterService() as unknown as Retrying
    const error = await service.runGeneration(chain, {}).catch((caught) => caught)
    assert.isTrue(OpenRouterService.isTimeout(error))
    assert.equal(calls, 2)
  })

  test('the per-call deadline is the configured one and the title call is shorter', async ({
    assert,
  }) => {
    const original = AbortSignal.timeout
    const deadlines: number[] = []
    AbortSignal.timeout = (ms: number) => {
      deadlines.push(ms)
      return original.call(AbortSignal, ms)
    }
    try {
      const service = new OpenRouterService() as unknown as Retrying
      const chain = RunnableLambda.from(async () => EXPECTED_DOCUMENT)
      await service.runGeneration(chain, {})
      await service.runGeneration(chain, {}, undefined, {
        timeoutMs: openRouterApiConfig.titleTimeoutMs,
      })
      assert.deepEqual(deadlines, [
        openRouterApiConfig.timeoutMs,
        openRouterApiConfig.titleTimeoutMs,
      ])
      // Worst case (title and document each time out twice) fits the 10-minute job limit.
      assert.isBelow(
        2 * openRouterApiConfig.titleTimeoutMs + 2 * openRouterApiConfig.timeoutMs,
        600_000
      )
    } finally {
      AbortSignal.timeout = original
    }
  })

  test('other retryable errors keep their three attempts; client errors are not retried', async ({
    assert,
  }) => {
    let calls = 0
    const flaky = RunnableLambda.from(async () => {
      if (++calls < 3) throw Object.assign(new Error('busy'), { status: 503 })
      return EXPECTED_DOCUMENT
    })
    const service = new OpenRouterService() as unknown as Retrying
    assert.deepEqual(await service.runGeneration(flaky, {}), EXPECTED_DOCUMENT)
    assert.equal(calls, 3)

    let rejected = 0
    const bad = RunnableLambda.from(async () => {
      rejected++
      throw Object.assign(new Error('bad request'), { status: 400 })
    })
    await service.runGeneration(bad, {}).catch(() => {})
    assert.equal(rejected, 1)
  })
})
