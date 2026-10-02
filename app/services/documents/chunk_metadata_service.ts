export type SourceChunk = {
  id: string
  chunkIndex: number
  content: string
  fileName: string
  fileUrl: string | null
  mediaType: string | null
  pageNumber?: number | null
}

type TipTapNode = {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: unknown[]
  content?: TipTapNode[]
}

export type TipTapDocument = {
  type: 'doc'
  content: TipTapNode[]
}

function isWebUrl(value: string | null): value is string {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Resolve model-created chunk references to metadata from the retrieved chunks.
 * The model may select IDs, but it cannot supply URLs or source text.
 */
export function attachChunkMetadata(
  document: TipTapDocument,
  sourceChunks: SourceChunk[]
): TipTapDocument {
  const chunksById = new Map(sourceChunks.map((chunk) => [chunk.id, chunk]))

  function enrich(node: TipTapNode): TipTapNode | null {
    if (node.type === 'sourceCitation' || node.type === 'image') {
      const sourceChunkId = node.attrs?.sourceChunkId
      const source = typeof sourceChunkId === 'string' ? chunksById.get(sourceChunkId) : undefined

      if (!source) return null

      if (node.type === 'image') {
        if (!source.mediaType?.startsWith('image/') || !isWebUrl(source.fileUrl)) return null

        return {
          type: 'image',
          attrs: {
            sourceChunkId: source.id,
            src: source.fileUrl,
            alt:
              typeof node.attrs?.alt === 'string' && node.attrs.alt.trim()
                ? node.attrs.alt
                : source.fileName,
            title:
              typeof node.attrs?.title === 'string' && node.attrs.title.trim()
                ? node.attrs.title
                : source.fileName,
            chunkText: source.content,
            fileName: source.fileName,
            fileUrl: source.fileUrl,
            mediaType: source.mediaType,
            chunkIndex: source.chunkIndex,
            pageNumber: source.pageNumber ?? null,
          },
        }
      }

      return {
        type: 'sourceCitation',
        attrs: {
          sourceChunkId: source.id,
          chunkText: source.content,
          fileName: source.fileName,
          fileUrl: source.fileUrl,
          mediaType: source.mediaType,
          chunkIndex: source.chunkIndex,
          pageNumber: source.pageNumber ?? null,
        },
      }
    }

    if (!node.content) return node

    return {
      ...node,
      content: node.content.map(enrich).filter((child): child is TipTapNode => child !== null),
    }
  }

  return {
    ...document,
    content: document.content.map(enrich).filter((node): node is TipTapNode => node !== null),
  }
}
