import { test } from '@japa/runner'
import { RunnableLambda } from '@langchain/core/runnables'

import openRouterApiConfig from '#config/open_router'
import OpenRouterService from '#services/open_router_service'

type TestableOpenRouterService = {
  model: { model: string; apiKey: string }
  structuredModel: { invoke: (input: unknown) => Promise<unknown> }
  generateDocumentInit: (title: string, description: string) => Promise<unknown>
}

const EXPECTED_DOCUMENT = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Generated content' }] }],
}

test.group('OpenRouterService', () => {
  test('is constructed with the configured OpenRouter model and API key', ({ assert }) => {
    const service = new OpenRouterService() as unknown as TestableOpenRouterService

    assert.equal(service.model.model, openRouterApiConfig.model)
    assert.equal(service.model.apiKey, openRouterApiConfig.apiKey)
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
})
