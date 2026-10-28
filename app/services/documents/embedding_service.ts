import { createHash } from 'node:crypto'

import embeddingsConfig from '#config/embeddings'
import openRouterApiConfig from '#config/open_router'
import logger from '@adonisjs/core/services/logger'
import { OpenAIEmbeddings } from '@langchain/openai'
import { countTokens } from 'gpt-tokenizer'

const MAX_BATCH_ITEMS = 128
const MAX_BATCH_TOKENS = 100_000
const MAX_ATTEMPTS = 3

export default class EmbeddingService {
  private embeddingModel = new OpenAIEmbeddings({
    openAIApiKey: embeddingsConfig.apiKey(),
    configuration: {
      baseURL: embeddingsConfig.baseUrl,
    },
    model: embeddingsConfig.model,
    dimensions: embeddingsConfig.dimensions,
    batchSize: MAX_BATCH_ITEMS,
    maxRetries: 0,
    timeout: 90000,
  })

  async embedQuery(text: string, guard?: () => Promise<void>) {
    const vector = await this.withRetry(async () => {
      await guard?.()
      return this.embeddingModel.embedQuery(text)
    })
    this.assertDimension(vector)
    return vector
  }

  async embedTexts(texts: string[], guard?: () => Promise<void>) {
    const batches = this.splitBatches(texts)
    const vectors: number[][] = []

    for (const batch of batches) {
      const result = await this.withRetry(async () => {
        await guard?.()
        return this.embeddingModel.embedDocuments(batch)
      })
      if (result.length !== batch.length) {
        throw new Error('Embedding provider returned a different number of vectors than inputs')
      }

      result.forEach((vector) => this.assertDimension(vector))
      vectors.push(...result)
    }

    return vectors
  }

  inputHash(text: string) {
    return createHash('sha256')
      .update(
        [
          openRouterApiConfig.embeddingModel,
          openRouterApiConfig.pipelineVersion,
          openRouterApiConfig.embeddingDimensions,
          text,
        ].join('\0')
      )
      .digest('hex')
  }

  private splitBatches(texts: string[]) {
    const batches: string[][] = []
    let batch: string[] = []
    let tokenTotal = 0

    for (const text of texts) {
      const tokenCount = countTokens(text)
      if (tokenCount > 700) throw new Error('Embedding input exceeds the 700-token chunk limit')

      if (
        batch.length >= MAX_BATCH_ITEMS ||
        (batch.length > 0 && tokenTotal + tokenCount > MAX_BATCH_TOKENS)
      ) {
        batches.push(batch)
        batch = []
        tokenTotal = 0
      }

      batch.push(text)
      tokenTotal += tokenCount
    }

    if (batch.length) batches.push(batch)
    return batches
  }

  private assertDimension(vector: number[]) {
    if (vector.length !== openRouterApiConfig.embeddingDimensions) {
      throw new Error(
        `Embedding provider returned ${vector.length} dimensions; configured for ${openRouterApiConfig.embeddingDimensions}`
      )
    }

    if (vector.some((value) => !Number.isFinite(value))) {
      throw new Error('Embedding provider returned non-finite vector values')
    }
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await operation()
      } catch (error) {
        if (attempt === MAX_ATTEMPTS || !this.isRetryable(error)) throw error

        const delay = 500 * 2 ** (attempt - 1)
        const jitter = Math.random() * delay * 0.3
        logger.warn({ err: error, attempt }, 'Transient embedding request failed; retrying')
        await new Promise((resolve) => setTimeout(resolve, delay + jitter))
      }
    }

    throw new Error('Embedding request exhausted its retry budget')
  }

  private isRetryable(error: unknown) {
    if (!error || typeof error !== 'object') return false

    const value = error as {
      status?: number
      statusCode?: number
      code?: string
      cause?: { code?: string }
    }
    const status = value.status ?? value.statusCode
    if (status === 429 || (typeof status === 'number' && status >= 500)) return true

    return new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN']).has(
      value.code ?? value.cause?.code ?? ''
    )
  }
}
