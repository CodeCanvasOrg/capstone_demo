import OpenRouterService from '#services/open_router_service'

type UserInput = {
  title: string
  description: string | null
}

export default async function initDocumentContent({ title, description }: UserInput) {
  const openRouterService = new OpenRouterService()
  return await openRouterService.generateDocumentInit(title, description ?? '')
}
