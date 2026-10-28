export type SourceLocator = {
  fileKey: string
  fileUrl: string
  fileName: string
  mediaType: string
  pageNumber?: number
  element?: string
  headingLevel?: number
  lineNumber?: number
  [key: string]: unknown
}

export type CanonicalBlock = {
  id: string
  blockType: 'heading' | 'paragraph' | 'list_item' | 'table_row' | 'image' | 'code'
  text: string
  orderIndex: number
  sectionPath: string[]
  sourceLocator: SourceLocator
  extractionMethod: string
  confidence: number | null
}

export type IndexedChunk = {
  id: string
  chunkIndex: number
  content: string
  fileKey: string
  fileName: string
  fileUrl: string
  mediaType: string
  pageNumber: number | null
  kind: 'text' | 'image'
  tokenCount: number
  contentHash: string
  blockIds: string[]
  /** Derived retrieval context; embedded and indexed with `content`, never shown as evidence. */
  context?: string | null
}

export type PreparedDocument = {
  blocks: CanonicalBlock[]
  chunks: IndexedChunk[]
}
