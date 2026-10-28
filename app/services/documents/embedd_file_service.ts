import embeddingsConfig from '#config/embeddings'
import { OpenAIEmbeddings } from '@langchain/openai'
import { similarity } from 'ml-distance'

export default class EmbeddFileService {
  private readonly MIN_SIMILARITY = 0.15

  private embeddingModel: OpenAIEmbeddings

  constructor() {
    this.embeddingModel = new OpenAIEmbeddings({
      openAIApiKey: embeddingsConfig.apiKey(),
      configuration: {
        baseURL: embeddingsConfig.baseUrl,
      },
      model: embeddingsConfig.model,
      dimensions: embeddingsConfig.dimensions,
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
