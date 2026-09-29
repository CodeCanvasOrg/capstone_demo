import openRouterApiConfig from '#config/open_router'
import { ChatOpenRouter } from '@langchain/openrouter'
import { getStructuredOutput, getInitPrompt } from './structured_model_output_service.ts'
import type { Runnable } from '@langchain/core/runnables'
import { Document } from '@langchain/core/documents'
import EmbeddFileService from './documents/embedd_file_service.ts'

type Chunk = {
  chunkIndex: number
  content: string
  embedding: number[]
  fileKey?: string
}

type GenProps = {
  title: string
  description: string
  context: string
}

export default class OpenRouterService {
  private model: ChatOpenRouter
  private embeddService: EmbeddFileService
  private structuredModel: Runnable<any, Object>
  private MAX_RETRIES: number

  constructor() {
    this.model = new ChatOpenRouter({
      model: openRouterApiConfig.model,
      apiKey: openRouterApiConfig.apiKey,
    })

    this.embeddService = new EmbeddFileService()

    this.structuredModel = this.model.withStructuredOutput(getStructuredOutput(), {
      method: 'functionCalling',
    })

    this.MAX_RETRIES = 2
  }

  async generateDocumentInit(title: string, description: string, chunks: Chunk[] = []) {
    const context = chunks.length ? await this.createRelevantContext(description, chunks) : ''

    const promptTemplate = getInitPrompt()

    const tipTapChain = promptTemplate.pipe(this.structuredModel)

    const result = await this.runGeneration(tipTapChain, {
      title,
      description,
      context,
    })

    return result
  }

  private async runGeneration(chain: Runnable, input: GenProps) {
    for (let i = 1; i <= this.MAX_RETRIES; i++) {
      try {
        const result = await chain.invoke(input)
        return result
      } catch (error) {
        if (i < this.MAX_RETRIES) continue
        throw error
      }
    }
  }

  private async createRelevantContext(description: string, chunks: Chunk[]) {
    const vectors = chunks.map((chunk) => chunk.embedding)
    const relatedVectors = await this.embeddService.similaritySearch(description, vectors)
    const relatedChunks = relatedVectors.map((vector) => chunks[vector.index])

    return await this.createContext(relatedChunks)
  }

  private async createContext(chunks: Chunk[]) {
    const documents = chunks.map(
      (chunk) =>
        new Document({
          pageContent: chunk.content,
          metadata: {
            filekey: chunk.fileKey,
            chunkIndex: chunk.chunkIndex,
          },
        })
    )

    const context = documents
      .map(
        (document) =>
          `[Source: ${document.metadata.filekey}, Chunk: ${document.metadata.chunkIndex}]\n${document.pageContent}`
      )
      .join('\n\n')

    return context
  }
}
