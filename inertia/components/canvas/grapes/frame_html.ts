import { generateHTML } from '@tiptap/html'
import type { JSONContent } from '@tiptap/core'
import { documentExtensions } from '../../../../shared/editor/schema.ts'
import type { Frame } from '../../../../shared/canvas/model.ts'
import { imageCss } from '../../../../shared/canvas/css.ts'

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

export function textHtml(doc: unknown[]) {
  extensions ??= documentExtensions()
  return generateHTML(
    { type: 'doc', content: doc.length ? doc : [{ type: 'paragraph' }] } as JSONContent,
    extensions
  )
}

export function frameHtml(frame: Frame, imageUrl: (id: string) => string) {
  switch (frame.kind) {
    case 'text':
      return textHtml(frame.doc)
    case 'figure':
      return `<span class="cv-figure-value">${esc(frame.value)}</span>${
        frame.label ? `<span class="cv-figure-label">${esc(frame.label)}</span>` : ''
      }`
    case 'image':
      return frame.imageId
        ? `<img src="${esc(imageUrl(frame.imageId))}" alt="${esc(frame.alt)}" style="${imageCss(frame)}" draggable="false" />`
        : '<div class="cv-image-empty">Choose an image</div>'
    case 'art':
      return frame.art === 'ribbons' ? '<div class="cv-art-ribbons"></div>' : ''
    case 'shape':
      return ''
  }
}
