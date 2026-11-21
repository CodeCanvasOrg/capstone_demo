import { test } from '@japa/runner'
import { RunnableLambda } from '@langchain/core/runnables'
import { OutputParserException } from '@langchain/core/output_parsers'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'

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
  type: 'doc' as const,
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

test.group('OpenRouterService | malformed output recovery', () => {
  test('retries parser errors but stops after three calls', async ({ assert }) => {
    let calls = 0
    const chain = RunnableLambda.from(() => {
      calls++
      throw new OutputParserException('Malformed outline', '{"sections":[{"type":"paragraph"}]}')
    })
    let guards = 0
    const service = new OpenRouterService() as unknown as Retrying
    await assert.rejects(
      () =>
        service.runGeneration(chain, {}, async () => {
          guards++
        }),
      /Malformed outline/
    )
    assert.equal(calls, 3)
    assert.equal(guards, 3)
  })

  test('does not call the model again after a guard rejects a parser retry', async ({ assert }) => {
    let calls = 0
    let guards = 0
    const chain = RunnableLambda.from(() => {
      calls++
      throw new OutputParserException('Malformed outline', '{}')
    })
    const service = new OpenRouterService() as unknown as Retrying
    await assert.rejects(
      () =>
        service.runGeneration(chain, {}, async () => {
          if (++guards === 2) throw new Error('Task no longer current')
        }),
      /Task no longer current/
    )
    assert.equal(calls, 1)
  })

  test('retries empty freeform output and preserves misplaced prose on recovery', async ({
    assert,
  }) => {
    const service = new OpenRouterService() as unknown as TestableOpenRouterService
    let calls = 0
    service.structuredModel = RunnableLambda.from(() =>
      ++calls === 1
        ? {
            type: 'doc',
            content: [{ type: 'heading', content: [{ type: 'text', text: 'Only template' }] }],
          }
        : { type: 'doc', content: [{ type: 'paragraph', text: 'Recovered body prose.' }] }
    )
    const result = await service.generateDocumentInit('Title', 'Brief')
    const rendered = ProseMirrorNode.fromJSON(getSchema([StarterKit]), result)
    rendered.check()
    assert.include(rendered.textContent, 'Recovered body prose.')
    assert.equal(calls, 2)
  })

  test('rejects missing, duplicate and empty outline sections before accepting complete prose', async ({
    assert,
  }) => {
    const service = new OpenRouterService()
    let calls = 0
    const body = [{ type: 'paragraph', text: 'Generated body prose.' }]
    const attempts = [
      { sections: [{ key: 'section_0', content: body }] },
      {
        sections: [
          { key: 'section_0', content: body },
          { key: 'section_0', content: body },
        ],
      },
      {
        sections: [
          { key: 'section_0', content: body },
          { key: 'section_1', content: body },
        ],
      },
    ]
    ;(service as any).model = {
      withStructuredOutput: () => RunnableLambda.from(() => attempts[calls++]),
    }
    const result = await service.generateOutlineWithEvidence(
      'Title',
      'Brief',
      [],
      {
        schemaVersion: 2,
        name: 'Test',
        description: '',
        instructions: '',
        outline: '# Title\n## Summary',
      },
      async () => {}
    )
    const rendered = ProseMirrorNode.fromJSON(getSchema([StarterKit]), result)
    rendered.check()
    assert.include(rendered.textContent, 'Generated body prose.')
    assert.equal(calls, 3)
  })

  test('never accepts an outline containing only empty sections', async ({ assert }) => {
    const service = new OpenRouterService()
    let calls = 0
    ;(service as any).model = {
      withStructuredOutput: () =>
        RunnableLambda.from(() => {
          calls++
          return {
            sections: [
              { key: 'section_0', content: [] },
              { key: 'section_1', content: [] },
            ],
          }
        }),
    }
    await assert.rejects(
      () =>
        service.generateOutlineWithEvidence(
          'Title',
          'Brief',
          [],
          {
            schemaVersion: 2,
            name: 'Test',
            description: '',
            instructions: '',
            outline: '# Title\n## Summary',
          },
          async () => {}
        ),
      /no readable body text/
    )
    assert.equal(calls, 3)
  })
})

test.group('OpenRouterService | wire parser and revision budget', () => {
  test('recovers the reported malformed tool call through the installed parser', async ({
    assert,
  }) => {
    const originalFetch = globalThis.fetch
    const requests: any[] = []
    globalThis.fetch = async (_url, options) => {
      requests.push(JSON.parse(String(options?.body)))
      const sections =
        requests.length === 1
          ? [
              { key: 'section_0', content: [{ type: 'paragraph', text: 'Generated prose.' }] },
              { type: 'paragraph' },
            ]
          : ['section_0', 'section_1'].map((key) => ({
              key,
              content: [{ type: 'paragraph', text: 'Generated prose.' }],
            }))
      return new Response(
        JSON.stringify({
          id: 'offline',
          model: openRouterApiConfig.model,
          choices: [
            {
              index: 0,
              finish_reason: 'tool_calls',
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'fill',
                    type: 'function',
                    function: {
                      name: 'fill_document_outline',
                      arguments: JSON.stringify({ sections }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }
    try {
      const result = await new OpenRouterService().generateOutlineWithEvidence(
        'Title',
        'Brief',
        [],
        {
          schemaVersion: 2,
          name: 'Test',
          description: '',
          instructions: '',
          outline: '# Title\n## Summary',
        },
        async () => {}
      )
      const rendered = ProseMirrorNode.fromJSON(getSchema([StarterKit]), result)
      rendered.check()
      assert.include(rendered.textContent, 'Generated prose.')
      assert.equal(requests.length, 2)
      assert.include(
        JSON.stringify(requests[1].messages.at(-1)),
        'previous response could not be used'
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('invalid revision edits share one three-call budget', async ({ assert }) => {
    const service = new OpenRouterService()
    let calls = 0
    ;(service as any).model = {
      withStructuredOutput: () =>
        RunnableLambda.from(() => {
          calls++
          return {
            edits: [{ action: 'replace', index: 999, content: EXPECTED_DOCUMENT.content }],
            summary: 'Invalid edit',
          }
        }),
    }
    await assert.rejects(
      () => service.reviseDocument(EXPECTED_DOCUMENT, 'Revise'),
      /conflicting edits/
    )
    assert.equal(calls, 3)
  })

  test('a brief is retried until it is three or four sentences', async ({ assert }) => {
    const service = new OpenRouterService()
    let calls = 0
    const seen: unknown[] = []
    const attempts = [
      { brief: 'Too short.' },
      { brief: 'One. Two. Three. Four. Five.' },
      { brief: '  Acme hired us.  They had a problem. We built a fix. Costs fell 20%. ' },
    ]
    ;(service as any).model = {
      withStructuredOutput: () =>
        RunnableLambda.from((input: unknown) => {
          seen.push(input)
          return attempts[calls++]
        }),
    }
    const brief = await service.generateBrief({ project: 'Acme', draft: null }, [])
    assert.equal(brief, 'Acme hired us. They had a problem. We built a fix. Costs fell 20%.')
    assert.equal(calls, 3)
    assert.match(JSON.stringify(seen[1]), /exactly three or four sentences/)
  })
})
