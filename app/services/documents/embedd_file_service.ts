import openRouterApiConfig from '#config/open_router'
import { OpenAIEmbeddings } from '@langchain/openai'
import { similarity } from 'ml-distance'

export default class EmbeddFileService {
  private readonly MIN_SIMILARITY = 0.15

  private embeddingModel: OpenAIEmbeddings

  constructor() {
    this.embeddingModel = new OpenAIEmbeddings({
      openAIApiKey: openRouterApiConfig.apiKey.release(),
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
      model: openRouterApiConfig.embeddingModel,
      dimensions: openRouterApiConfig.embeddingDimensions,
    })
  }

  async embeddText(text: string) {
    const vector = await this.embeddingModel.embedQuery(text)

    return vector
  }

  async embeddTexts(texts: string[]) {
    return this.embeddingModel.embedDocuments(texts)
  }

  async similaritySearch(query: string, vectors: number[][]) {
    const vectorQuery = await this.embeddText(query)

    const search = vectors
      .map((vector, index) => ({
        index,
        similarity: similarity.cosine(vectorQuery, vector),
      }))
      .filter(({ similarity: score }) => Number.isFinite(score) && score >= this.MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20)

    return search
  }
}
