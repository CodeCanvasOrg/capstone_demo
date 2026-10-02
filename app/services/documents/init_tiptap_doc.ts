import OpenRouterService from '#services/open_router_service'
import type { SourceChunk } from './chunk_metadata_service.ts'

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

type Chunk = SourceChunk & {
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
