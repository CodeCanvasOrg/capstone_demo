import { generateHTML } from '@tiptap/html'
import type { JSONContent } from '@tiptap/core'
import { documentExtensions } from '../../../../shared/editor/schema.ts'
import type { Frame } from '../../../../shared/canvas/model.ts'
import { imageCss } from '../../../../shared/canvas/css.ts'
import { hexagonsSvg, thumbnailsSvg } from '../../../../shared/canvas/portfolio/tokens.ts'

/**
 * What a frame shows inside the editor canvas. Text uses the one document
 * schema, so what is drawn here is what the export prints (the export resolves
 * citations to numbered references). Escaping: Tiptap's renderer escapes text;
 * every other value is escaped here.
 */
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )

let extensions: ReturnType<typeof documentExtensions> | undefined

/** A citation chip, as the schema renders it: its chunk id is all the editor knows about the source. */
const CHIP = /<span\b[^>]*data-source-chunk-id="([^"]+)"[^>]*>[^<]*<\/span>/g

/**
 * With footnote numbers (a portfolio canvas), each citation is drawn the way the export prints
 * it: a superscript number. Without them the schema's own chip is kept.
 */
export function textHtml(doc: unknown[], cites?: ReadonlyMap<string, number>) {
  extensions ??= documentExtensions()
  const html = generateHTML(
    { type: 'doc', content: doc.length ? doc : [{ type: 'paragraph' }] } as JSONContent,
    extensions
  )
  return cites
    ? html.replace(CHIP, (chip, id: string) =>
        cites.has(id) ? `<sup class="ref">${cites.get(id)}</sup>` : chip
      )
    : html
}

export function frameHtml(
  frame: Frame,
  imageUrl: (id: string) => string,
  cites?: ReadonlyMap<string, number>
) {
  switch (frame.kind) {
    case 'text':
      return textHtml(frame.doc, cites)
    case 'figure':
      return `<span class="cv-figure-value">${esc(frame.value)}</span>${
        frame.label ? `<span class="cv-figure-label">${esc(frame.label)}</span>` : ''
      }`
    case 'image':
      return frame.imageId
        ? `<img src="${esc(imageUrl(frame.imageId))}" alt="${esc(frame.alt)}" style="${imageCss(frame)}" draggable="false" />`
        : '<div class="cv-image-empty">Choose an image</div>'
    case 'art':
      if (frame.art === 'hexagons') return hexagonsSvg()
      if (frame.art === 'thumbnails') return thumbnailsSvg()
      return frame.art === 'ribbons' ? '<div class="cv-art-ribbons"></div>' : ''
    case 'shape':
      return ''
  }
}
