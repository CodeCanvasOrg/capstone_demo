import openRouterApiConfig from '#config/open_router'
import { HumanMessage } from '@langchain/core/messages'
import type { Runnable } from '@langchain/core/runnables'
import { ChatOpenRouter } from '@langchain/openrouter'
import {
  attachChunkMetadata,
  type SourceChunk,
  type TipTapDocument,
} from './documents/chunk_metadata_service.ts'
import EmbeddFileService from './documents/embedd_file_service.ts'
import { getInitPrompt, getStructuredOutput } from './structured_model_output_service.ts'

type Chunk = SourceChunk & {
  embedding: number[]
  fileKey?: string
}

type GenProps = {
  title: string
  description: string
  context: string
}

type ImageUrlContent = {
  type: 'image_url'
  image_url: { url: string; detail: 'auto' }
}

type TextContent = {
  type: 'text'
  text: string
}

const MAX_SOURCE_IMAGES = 4

export default class OpenRouterService {
  private model: ChatOpenRouter
  private embeddService: EmbeddFileService
  private structuredModel: Runnable<any, Object>
  private MAX_ATTEMPTS: number

  constructor() {
    this.model = new ChatOpenRouter({
      model: openRouterApiConfig.model,
      apiKey: openRouterApiConfig.apiKey.release(),
      maxRetries: 0,
    })

    this.embeddService = new EmbeddFileService()

    this.structuredModel = this.model.withStructuredOutput(getStructuredOutput(), {
      method: 'functionCalling',
    })

    this.MAX_ATTEMPTS = 3
  }

  async generateDocumentInit(title: string, description: string, chunks: Chunk[] = []) {
    const relevantChunks = chunks.length ? await this.findRelevantChunks(description, chunks) : []
    return this.generateDocumentWithEvidence(title, description, relevantChunks)
  }

  async generateDocumentWithEvidence(
    title: string,
    description: string,
    relevantChunks: SourceChunk[],
    guard?: () => Promise<void>
  ) {
    const context = this.createContext(relevantChunks)
    const promptMessages = await getInitPrompt().formatMessages({
      title,
      description,
      context,
    } satisfies GenProps)

    const humanMessage = promptMessages[promptMessages.length - 1]
    const humanText = typeof humanMessage.content === 'string' ? humanMessage.content : ''
    const multimodalContent: Array<TextContent | ImageUrlContent> = [
      {
        type: 'text',
        text: humanText,
      },
    ]

    for (const chunk of relevantChunks) {
      const modelFileUrl = chunk.modelFileUrl ?? chunk.fileUrl
      if (!chunk.mediaType?.startsWith('image/') || !modelFileUrl || !this.isWebUrl(modelFileUrl)) {
        continue
      }

      if (
        multimodalContent.filter((block) => block.type === 'image_url').length >= MAX_SOURCE_IMAGES
      ) {
        break
      }

      multimodalContent.push({
        type: 'text',
        text: `Visual evidence for source chunk ${chunk.id} from ${chunk.fileName}.`,
      })
      multimodalContent.push({
        type: 'image_url',
        image_url: { url: modelFileUrl, detail: 'auto' },
      })
    }

    const messages = [
      ...promptMessages.slice(0, -1),
      new HumanMessage({ content: multimodalContent as never }),
    ]

    const result = await this.runGeneration(this.structuredModel, messages, guard)

    return attachChunkMetadata(result as TipTapDocument, relevantChunks)
  }

  private async runGeneration(chain: Runnable, input: unknown, guard?: () => Promise<void>) {
    for (let i = 1; i <= this.MAX_ATTEMPTS; i++) {
      try {
        await guard?.()
        return await chain.invoke(input, { signal: AbortSignal.timeout(90000) })
      } catch (error) {
        if (i < this.MAX_ATTEMPTS && this.isRetryable(error)) {
          const delay = 250 * 2 ** (i - 1)
          const jitter = Math.random() * delay * 0.3
          await new Promise((resolve) => setTimeout(resolve, delay + jitter))
          continue
        }

        throw error
      }
    }
  }

  private async findRelevantChunks(description: string, chunks: Chunk[]) {
    const candidateChunks = chunks.filter(
      (chunk) => chunk.embedding.length > 0 && chunk.content.trim()
    )
    if (candidateChunks.length === 0) return []

    const related = await this.embeddService.similaritySearch(
      description,
      candidateChunks.map((c) => c.embedding)
    )
    return related.map(({ index }) => candidateChunks[index]).filter((chunk) => chunk !== undefined)
  }

  private createContext(chunks: SourceChunk[]) {
    return chunks
      .map(
        (chunk) =>
          `[Source chunk ID: ${chunk.id}; File: ${chunk.fileName}; Chunk: ${chunk.chunkIndex + 1}${chunk.pageNumber ? `; Page: ${chunk.pageNumber}` : ''}]\n${chunk.content}`
      )
      .join('\n\n')
  }

  private isWebUrl(value: string) {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
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

    const networkCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'])
    return networkCodes.has(value.code ?? '') || networkCodes.has(value.cause?.code ?? '')
  }
}
