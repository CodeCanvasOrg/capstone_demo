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

export default class OpenRouterService {
  private model: ChatOpenRouter
  private embeddService: EmbeddFileService
  private structuredModel: Runnable<any, Object>

  constructor() {
    this.model = new ChatOpenRouter({
      model: openRouterApiConfig.model,
      apiKey: openRouterApiConfig.apiKey,
    })

    this.embeddService = new EmbeddFileService()

    this.structuredModel = this.model.withStructuredOutput(getStructuredOutput(), {
      method: 'functionCalling',
    })
  }

  async generateDocumentInit(title: string, description: string, chunks: Chunk[]) {
    const vectors = chunks.map((chunk) => chunk.embedding)
    const relatedVectors = await this.embeddService.similaritySearch(description, vectors)
    const relatedChunks = relatedVectors.map((vector) => chunks[vector.index])

    const context = await this.createContext(relatedChunks)

    const promptTemplate = getInitPrompt()

    const tipTapChain = promptTemplate.pipe(this.structuredModel)

    const result = await tipTapChain.invoke({
      title,
      description,
      context,
    })

    return result
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
