import { test } from '@japa/runner'
import EmbeddingService from '#services/documents/embedding_service'
import OpenRouterService from '#services/open_router_service'
import config from '#config/open_router'
// Opt in only to the checked-in local Postman simulation. Never use live credentials here.
const enabled = config.baseUrl === 'http://127.0.0.1:4900/openrouter/api/v1'
test.group('Postman provider transport', () => {
  test('real embedding and chat clients read the local simulation contract', async ({ assert }) => {
    let checks = 0
    const vector = await new EmbeddingService().embedQuery(
      'Synthetic transport fixture',
      async () => {
        checks++
      }
    )
    assert.lengthOf(vector, config.embeddingDimensions)
    const content = await new OpenRouterService().generateDocumentWithEvidence(
      'Synthetic fixture',
      'Transport verification only',
      [],
      async () => {
        checks++
      }
    )
    assert.equal(content.type, 'doc')
    assert.include(JSON.stringify(content), 'Local integration fixture')
    assert.equal(checks, 2)
  }).skip(!enabled)
})
