import { getBrandKit, type BrandKit } from '../../../shared/layout/brand.ts'
import { hexagonsSvg, thumbnailsSvg } from '../../../shared/canvas/portfolio/tokens.ts'
import type { ClientBlock, ClientSource } from '../../../shared/publication/client.ts'
import {
  CANVAS_BASE_CSS,
  brandVars,
  declarations,
  frameCss,
  imageCss,
  sheetCss,
} from '../../../shared/canvas/css.ts'
import { readingOrder } from '../../../shared/canvas/derive.ts'
import type { CanvasDocument, Frame } from '../../../shared/canvas/model.ts'
import { esc, renderBlocks } from '#services/exports/client_blocks'
import { ribbonsSvg } from '#services/exports/collection_html'
import { fontFaces } from '#services/exports/layout_renderer'

/**
 * A canvas as one printable HTML page: an A4 sheet per canvas sheet, every frame
 * at its stored position, then the sources. Input is a canvas that already
 * passed parseCanvas, and frame text already projected to the closed client
 * union, so every value written here is either escaped or comes from a fixed
 * vocabulary (ids are plain tokens, CSS values come from shared/canvas/css.ts).
 * Never renders GrapesJS output.
 */
export const CANVAS_RENDERER_VERSION = 'canvas-1'

export type FrameContent = Map<string, ClientBlock[]>

/** The frames whose content comes from the text pipeline, in the order they are projected. */
export const projectedFrames = (canvas: CanvasDocument) =>
  canvas.sheets.flatMap((sheet) =>
    readingOrder(sheet).filter((frame) => frame.kind === 'text' || frame.kind === 'image')
  )

export type ImageFocus = ReadonlyMap<string, { x: number; y: number }>

function frameHtml(frame: Frame, content: FrameContent, brand: BrandKit, focus: ImageFocus) {
  const open = `<div class="cv-frame cv-${frame.kind}" id="${frame.id}">`
  switch (frame.kind) {
    case 'text':
      return `${open}${renderBlocks(content.get(frame.id) ?? [])}</div>`
    case 'figure':
      return `${open}<span class="cv-figure-value">${esc(frame.value)}</span>${
        frame.label ? `<span class="cv-figure-label">${esc(frame.label)}</span>` : ''
      }</div>`
    case 'image': {
      const image = content.get(frame.id)?.find((block) => block.type === 'image')
      const src = image?.type === 'image' ? image.src : undefined
      // Only embedded images reach the page; anything else would be a request from the renderer.
      return src?.startsWith('data:image/')
        ? `${open}<img src="${esc(src)}" alt="${esc(frame.alt)}" style="${imageCss(
            // A frame without a focal point of its own uses the one found when the image was uploaded.
            !frame.focus && frame.imageId && focus.has(frame.imageId)
              ? { ...frame, focus: focus.get(frame.imageId) }
              : frame
          )}" /></div>`
        : `${open}</div>`
    }
    case 'art':
      if (frame.art === 'hexagons') return `${open}${hexagonsSvg()}</div>`
      if (frame.art === 'thumbnails') return `${open}${thumbnailsSvg()}</div>`
      return frame.art === 'ribbons'
        ? `${open}${ribbonsSvg(frame.id, brand.palette.accent)}</div>`
        : `<div class="cv-frame cv-art cv-art-glow" id="${frame.id}"></div>`
    case 'shape':
      return `${open}</div>`
  }
}

/**
 * The brand a canvas is drawn with: a template's own kit when the canvas carries the template's
 * marker, otherwise the one pinned to the document's layout.
 */
export function brandForCanvas(canvas: Pick<CanvasDocument, 'template'>, pinned: BrandKit) {
  const own = canvas.template ? getBrandKit(canvas.template.id) : undefined
  return own?.templateOnly ? own : pinned
}

const sourcesSheet = (sources: ClientSource[]) =>
  sources.length
    ? `<section class="cv-sources"><h2>Sources</h2><ol>${sources
        .map((s) => `<li value="${s.number}">${esc(s.label)}${s.page ? `, p. ${s.page}` : ''}</li>`)
        .join('')}</ol></section>`
    : ''

function css(canvas: CanvasDocument, brand: BrandKit) {
  const rules = canvas.sheets.flatMap((sheet) => [
    `#${sheet.id}{${declarations(sheetCss(sheet))}}`,
    ...sheet.frames.map((frame) => `#${frame.id}{${declarations(frameCss(frame))}}`),
  ])
  return `
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
:root{${declarations(brandVars(brand))}}
body{font-family:"${brand.fonts[0]?.family ?? 'Arial'}",Arial,sans-serif;color:var(--cv-text);font-size:9.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cv-sheet{break-after:page}
.cv-sheet:last-of-type{break-after:auto}
.cv-sheet+.cv-sources{break-before:page}
.cv-frame sup.ref{font-size:.65em;line-height:0;margin-left:1px}
.cv-sources{min-height:297mm;padding:24mm 30mm 20mm 22mm}
.cv-sources h2{font-size:17pt;font-weight:800;color:var(--cv-primary);margin:0 0 6mm}
.cv-sources ol{padding-left:1.4em;font-size:8.6pt;line-height:1.5}
.cv-sources li{margin:0 0 1.5mm;break-inside:avoid;overflow-wrap:anywhere}
${CANVAS_BASE_CSS}
${rules.join('\n')}`
}

export async function renderCanvasHtml(
  canvas: CanvasDocument,
  brand: BrandKit,
  {
    content = new Map(),
    sources = [],
    preview = false,
    unsaved = false,
    focus = new Map(),
  }: {
    content?: FrameContent
    sources?: ClientSource[]
    preview?: boolean
    /** Drawn from the editor's autosaved draft, not a saved version. */
    unsaved?: boolean
    /** Stored focal point of each document image, for image frames that have none. */
    focus?: ImageFocus
  } = {}
) {
  const sheets = canvas.sheets
    .map(
      (sheet) =>
        `<section class="cv-sheet" id="${sheet.id}">${[...sheet.frames]
          // Painted in stacking order; z-index keeps it right even if a frame is out of order.
          .sort((a, b) => a.z - b.z)
          .map((frame) => frameHtml(frame, content, brand, focus))
          .join('')}</section>`
    )
    .join('\n')
  const banner = preview
    ? `<p style="position:fixed;top:4mm;right:4mm;margin:0;padding:3pt 8pt;background:#b42318;color:#fff;font-size:7pt;font-weight:800;z-index:9999">PREVIEW · ${unsaved ? 'UNSAVED CHANGES · ' : ''}NOT APPROVED FOR FINAL EXPORT</p>`
    : ''
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><style>${await fontFaces(brand)}${css(canvas, brand)}</style></head><body>${banner}${sheets}\n${canvas.template ? '' : sourcesSheet(sources)}</body></html>`
}

/**
 * Splits the projected body back into frames. The projection input is built by
 * `projectionDocument`: frames joined by page breaks, which a frame can never
 * contain, so the split is exact.
 */
export function splitProjected(canvas: CanvasDocument, body: ClientBlock[]): FrameContent {
  const frames = projectedFrames(canvas)
  if (!frames.length) return new Map()
  const parts: ClientBlock[][] = [[]]
  for (const block of body) {
    if (block.type === 'horizontalRule') parts.push([])
    else parts.at(-1)!.push(block)
  }
  if (parts.length !== frames.length)
    throw new Error(`Canvas projection mismatch: ${parts.length} parts for ${frames.length} frames`)
  return new Map(frames.map((frame, i) => [frame.id, parts[i]]))
}

/**
 * The document the text pipeline projects for a canvas export: a fixed title and
 * summary (the projection lifts those out of the body), then every text and
 * image frame in reading order, separated by page breaks. One projection keeps
 * citation numbers in reading order across the whole canvas.
 */
export function projectionDocument(canvas: CanvasDocument) {
  const frames = projectedFrames(canvas)
  const sentinel = (type: 'heading' | 'paragraph') => ({
    type,
    ...(type === 'heading' ? { attrs: { level: 1 } } : {}),
    content: [{ type: 'text', text: 'canvas' }],
  })
  return {
    type: 'doc' as const,
    content: [
      sentinel('heading'),
      sentinel('paragraph'),
      ...frames.flatMap((frame, i) => [
        ...(i > 0 ? [{ type: 'horizontalRule' }] : []),
        ...(frame.kind === 'text'
          ? frame.doc
          : frame.kind === 'image' && frame.imageId
            ? [{ type: 'image', attrs: { documentImageId: frame.imageId, alt: frame.alt || null } }]
            : []),
      ]),
    ],
  }
}
