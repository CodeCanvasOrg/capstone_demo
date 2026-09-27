import openRouterApiConfig from '#config/open_router'
import { OpenAIEmbeddings } from '@langchain/openai'
import { similarity } from 'ml-distance'

export default class EmbeddFileService {
  private embeddingModel: OpenAIEmbeddings

  constructor() {
    this.embeddingModel = new OpenAIEmbeddings({
      openAIApiKey: openRouterApiConfig.apiKey,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
      model: openRouterApiConfig.embeddingModel,
    })
  }

  async embeddText(text: string) {
    const vector = await this.embeddingModel.embedQuery(text)

    return vector
  }

  async similaritySearch(query: string, vectors: number[][]) {
    const vectorQuery = await this.embeddText(query)

    const search = vectors
      .map((vector, index) => ({
        index,
        similarity: 1 - similarity.cosine(vectorQuery, vector),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20)

    return search
  }
}
