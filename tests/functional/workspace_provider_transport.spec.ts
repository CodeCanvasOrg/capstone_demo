import { test } from '@japa/runner'
import EmbeddingService from '#services/documents/embedding_service'
import OpenRouterService from '#services/open_router_service'
import config from '#config/open_router'
import embeddingsConfig from '#config/embeddings'
import contextualization from '#config/contextualization'
import ContextualizationService from '#services/documents/contextualization_service'
import { randomUUID } from 'node:crypto'
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
    const title = await new OpenRouterService().generateTitle('Synthetic brief', [], async () => {
      checks++
    })
    assert.equal(title, 'Synthetic generated title')
    assert.equal(checks, 4)
  }).skip(!enabled)
})

const contextualizing =
  contextualization.provider === 'openrouter' && contextualization.baseUrl === simulation
test.group('Postman provider transport | contextualizer', () => {
  test('the real contextualizer client reads the local simulation contract', async ({ assert }) => {
    const id = randomUUID()
    const blockId = randomUUID()
    let checks = 0
    const result = await new ContextualizationService().contextualize(
      {
        blocks: [
          {
            id: blockId,
            blockType: 'paragraph',
            text: 'Synthetic fixture paragraph.',
            orderIndex: 0,
            sectionPath: ['Results'],
            sourceLocator: { fileKey: 'k', fileUrl: 'u', fileName: 'f.pdf', mediaType: 'x' },
            extractionMethod: 'fixture',
            confidence: null,
          },
        ],
        chunks: [
          {
            id,
            chunkIndex: 0,
            content: 'Synthetic fixture paragraph.',
            fileKey: 'k',
            fileName: 'f.pdf',
            fileUrl: 'u',
            mediaType: 'x',
            pageNumber: 1,
            kind: 'text',
            tokenCount: 4,
            contentHash: 'h',
            blockIds: [blockId],
          },
        ],
      },
      { title: 'Synthetic fixture', fileName: 'f.pdf' },
      async () => {
        checks++
      }
    )
    assert.equal(checks, 1)
    assert.equal(result.chunks[0].contextSource, 'llm')
    assert.equal(
      result.chunks[0].context,
      'Synthetic fixture › Results — page 1\nSynthetic context for transport verification only.'
    )
  }).skip(!contextualizing)
})
