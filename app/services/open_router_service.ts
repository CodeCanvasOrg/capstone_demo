import openRouterApiConfig from '#config/open_router'
import { ChatOpenRouter } from '@langchain/openrouter'
import { getStructuredOutput, getInitPrompt } from './structured_model_output_service.ts'
import type { Runnable } from '@langchain/core/runnables'

export default class OpenRouterService {
  private model: ChatOpenRouter
  private structuredModel: Runnable<any, Object>

  constructor() {
    this.model = new ChatOpenRouter({
      model: openRouterApiConfig.model,
      apiKey: openRouterApiConfig.apiKey,
    })

    this.structuredModel = this.model.withStructuredOutput(getStructuredOutput(), {
      method: 'functionCalling',
    })
  }

  async generateDocumentInit(title: string, description: string) {
    const promptTemplate = getInitPrompt()

    const tipTapChain = promptTemplate.pipe(this.structuredModel)

    const result = await tipTapChain.invoke({
      title,
      description,
    })

    return result
  }
}
