import { test } from '@japa/runner'
import config from '#config/open_router'
import contextualization from '#config/contextualization'
import { currentRunIdentity, isCurrentRun } from '#services/documents/pipeline_identity'
import { embeddingInput } from '#services/documents/embedding_service'
import EmbeddingService from '#services/documents/embedding_service'

test.group('Pipeline identity', () => {
  test('a run is current only while every identity field matches', ({ assert }) => {
    const current = currentRunIdentity()
    assert.deepEqual(current, {
      pipelineVersion: config.pipelineVersion,
      embeddingModel: config.embeddingModel,
      embeddingDimensions: config.embeddingDimensions,
      contextualizer: contextualization.identity,
    })
    assert.isTrue(isCurrentRun(current))
    assert.isFalse(isCurrentRun({ ...current, pipelineVersion: `${current.pipelineVersion}-old` }))
    assert.isFalse(isCurrentRun({ ...current, embeddingModel: 'another-model' }))
    assert.isFalse(isCurrentRun({ ...current, embeddingDimensions: 1 }))
    assert.isFalse(isCurrentRun({ ...current, embeddingModel: null }))
    assert.isFalse(isCurrentRun({ ...current, contextualizer: 'openrouter:other-model:v1' }))
    assert.isFalse(isCurrentRun({ ...current, contextualizer: null }))
  })

  test('the embedding hash describes the embedded text, including any context', ({ assert }) => {
    const plain = { content: 'Revenue grew 3%.' }
    const contextual = { content: 'Revenue grew 3%.', context: 'Acme Q2 2026 report › Results' }
    assert.equal(embeddingInput(plain), 'Revenue grew 3%.')
    assert.equal(embeddingInput(contextual), 'Acme Q2 2026 report › Results\n\nRevenue grew 3%.')
    const service = new EmbeddingService()
    assert.notEqual(
      service.inputHash(embeddingInput(plain)),
      service.inputHash(embeddingInput(contextual))
    )
  })
})
