import logger from '@adonisjs/core/services/logger'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import RetrievalService from '#services/documents/retrieval_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'
import { wordCount } from '../../../../shared/canvas/fit.ts'
import type { CanvasOptions, Depth } from '../../../../shared/canvas/options.ts'
import { getBrandKit } from '../../../../shared/layout/brand.ts'
import { anchor } from '../generation/page_queries.ts'
import type { GenerateInput } from '../generation/canvas_pipeline.ts'
import AiDesignImages, { type Picture } from './ai_design_images.ts'

/** The digest reads as much of the sources as the portfolio planner does. */
export const DIGEST_RETRIEVAL = { chunks: 30, tokens: 6000 } as const
/** A designed page needs about this many words of source to be written from. */
export const SOURCE_WORDS_PER_PAGE = 150
export const EXCERPTS = 12
export const EXCERPT_CHARS = 300

/** Pages by depth, cover included, when neither `pages` nor `entries` says. */
export const PAGES_BY_DEPTH: Record<Depth, number> = { concise: 4, standard: 6, detailed: 8 }

/**
 * The number of designed pages (the sources pages come on top). `pages` is exact; `entries` means a
 * cover and one page per entry; otherwise the depth decides, held down to what the sources can fill.
 */
export function designPageCount(
  options: Pick<CanvasOptions, 'pages' | 'entries' | 'depth'>,
  sourceWords?: number
) {
  if (typeof options.pages === 'number') return options.pages
  if (typeof options.entries === 'number') return options.entries + 1
  const wanted = PAGES_BY_DEPTH[options.depth]
  if (sourceWords === undefined) return wanted
  return Math.min(wanted, Math.max(3, Math.floor(sourceWords / SOURCE_WORDS_PER_PAGE) + 1))
}

export type BrandInfo = {
  id: string
  name: string
  palette: Record<string, string>
  fontFamily: string
}

/** The pinned layout brand, unless it is a template's own kit (that is not a company's brand). */
export async function brandInfo(
  context: WorkspaceAccessContext,
  documentId: string
): Promise<BrandInfo | null> {
  try {
    const selection = await new LayoutSelectionService().peek(context.workspaceId, documentId)
    const kit = getBrandKit(selection.brandId, selection.brandVersion)
    if (!kit || kit.templateOnly) return null
    return {
      id: kit.id,
      name: kit.name,
      palette: { ...kit.palette },
      fontFamily: kit.fonts[0]?.family ?? 'sans-serif',
    }
  } catch (error) {
    logger.warn({ err: error, documentId }, 'The brand kit was not read; the design uses no brand')
    return null
  }
}

export type Digest = {
  chunks: SourceChunk[]
  sourceWords: number
  images: Picture[]
  brand: BrandInfo | null
  pageCount: number
}

/** What the designer is shown: the sources, the pictures, the brand and the page count. */
export async function buildDigest(
  input: GenerateInput,
  images = new AiDesignImages()
): Promise<Digest> {
  const { context, documentId, pins, guard, options } = input
  const retrieval = new RetrievalService()
  const query = anchor(input.title, input.brief) || input.title
  const chunks = await retrieval.search({
    context,
    documentId,
    pins,
    query,
    guard,
    tokenBudget: DIGEST_RETRIEVAL.tokens,
    maxText: DIGEST_RETRIEVAL.chunks,
    imageMode: 'none',
  })
  const sourceWords = wordCount(chunks.map((c) => c.content).join(' '))
  let pictures: Picture[] = []
  if (options.images) {
    const [found] = await retrieval.searchPages({
      context,
      documentId,
      pins,
      guard,
      pages: [{ key: 'all', label: 'brief', queries: [query] }],
      tokenBudget: 1,
      imageLimit: 8,
    })
    pictures = await images.candidates({
      context,
      documentId,
      evidence: found?.images ?? [],
      guard,
    })
  }
  return {
    chunks,
    sourceWords,
    images: pictures,
    brand: await brandInfo(context, documentId),
    pageCount: designPageCount(options, chunks.length ? sourceWords : undefined),
  }
}

export const excerptsOf = (chunks: readonly SourceChunk[]) =>
  chunks.slice(0, EXCERPTS).map((c) => ({
    file: c.fileName,
    page: c.pageNumber ?? null,
    text: c.content.replace(/\s+/g, ' ').trim().slice(0, EXCERPT_CHARS),
  }))
