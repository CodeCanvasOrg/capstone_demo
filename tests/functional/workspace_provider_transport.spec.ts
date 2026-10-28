import { test } from '@japa/runner'
import EmbeddingService from '#services/documents/embedding_service'
import OpenRouterService from '#services/open_router_service'
import config from '#config/open_router'
import embeddingsConfig from '#config/embeddings'
import OutlineTemplateService from '#services/documents/outline_template_service'
// Opt in only to the checked-in local Postman simulation. Never use live credentials here.
// Embeddings have their own base URL, so both clients must target the simulation.
const simulation = 'http://127.0.0.1:4900/openrouter/api/v1'
const enabled = config.baseUrl === simulation && embeddingsConfig.baseUrl === simulation
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
    const template = await new OutlineTemplateService().resolve('portfolio')
    const outlined = await new OpenRouterService().generateOutlineWithEvidence(
      'Synthetic fixture',
      'Transport verification only',
      [],
      template.definition,
      async () => {
        checks++
      }
    )
    assert.include(JSON.stringify(outlined), 'Executive Summary')
    assert.include(JSON.stringify(outlined), 'Synthetic section content')
    assert.equal(checks, 3)
  }).skip(!enabled)
})
