import OpenRouterService from '#services/open_router_service'

type UserInput = {
  title: string
  description: string | null
}

type FileProps = {
  filename: string
  objectKey: string
  objectUrl: string
  chunks: Chunk[]
}

type Chunk = {
  chunkIndex: number
  content: string
  embedding: number[]
  fileKey?: string
}

export default async function initDocumentContent(
  { title, description }: UserInput,
  files: FileProps[]
) {
  const openRouterService = new OpenRouterService()
  return await openRouterService.generateDocumentInit(
    title,
    description ?? '',
    files.flatMap((file) => file.chunks)
  )
}
