export type SourceChunk = {
  id: string
  chunkIndex: number
  content: string
  fileName: string
  fileUrl: string | null
  modelFileUrl?: string | null
  mediaType: string | null
  pageNumber?: number | null
  /** Heading path of the chunk's first block; structural fact, safe to show the model. */
  section?: string | null
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
  /** Root attributes, e.g. `publication` annotations; carried through hydration untouched. */
  attrs?: Record<string, unknown>
  content: TipTapNode[]
}

export type DocumentImageReference = {
  id: string
  src: string
  filename: string
  mime: string
}

/** Hydration replaces display fields only; stable block identity must survive it. */
function keepNodeId(node: TipTapNode) {
  return typeof node.attrs?.nodeId === 'string' ? { nodeId: node.attrs.nodeId } : {}
}

function isWebUrl(value: string | null): value is string {
  if (!value) return false
  if (/^\/workspaces\/[0-9a-f-]+\/(files|documents)\//i.test(value)) return true

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
  sourceChunks: SourceChunk[],
  documentImages: ReadonlyMap<string, DocumentImageReference> = new Map()
): TipTapDocument {
  const chunksById = new Map(sourceChunks.map((chunk) => [chunk.id, chunk]))

  function enrich(node: TipTapNode): TipTapNode | null {
    if (node.type === 'image' && typeof node.attrs?.documentImageId === 'string') {
      const image = documentImages.get(node.attrs.documentImageId)
      if (!image) return null
      return {
        type: 'image',
        attrs: {
          ...keepNodeId(node),
          documentImageId: image.id,
          src: image.src,
          alt: typeof node.attrs.alt === 'string' ? node.attrs.alt : image.filename,
          title: typeof node.attrs.title === 'string' ? node.attrs.title : null,
          width: node.attrs.width ?? '100%',
          height: node.attrs.height ?? null,
          align: node.attrs.align ?? 'center',
        },
      }
    }
    if (node.type === 'sourceCitation' || node.type === 'image') {
      const sourceChunkId = node.attrs?.sourceChunkId
      const source = typeof sourceChunkId === 'string' ? chunksById.get(sourceChunkId) : undefined

      if (!source) return null

      if (node.type === 'image') {
        if (!source.mediaType?.startsWith('image/') || !isWebUrl(source.fileUrl)) return null

        return {
          type: 'image',
          attrs: {
            ...keepNodeId(node),
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
            width: node.attrs?.width ?? '100%',
            height: node.attrs?.height ?? null,
            align: node.attrs?.align ?? 'center',
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

/** Count visible evidence nodes without trusting any model-supplied metadata. */
export function evidenceNodeCount(document: TipTapDocument): number {
  const count = (node: TipTapNode): number =>
    Number(node.type === 'sourceCitation' || node.type === 'image') +
    (node.content?.reduce((total, child) => total + count(child), 0) ?? 0)
  return document.content.reduce((total, node) => total + count(node), 0)
}
