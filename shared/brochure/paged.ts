import type { JSONContent } from '@tiptap/core'

/**
 * The brochure editor shows one sheet per page, so while editing the document is
 * `doc > page+ > blocks`. What is stored stays the flat form with a horizontal
 * rule between pages (see content.ts); these two functions convert at the edge.
 * Browser-safe.
 */
export const PAGE = 'page'

export function toPaged(doc: JSONContent | null | undefined): JSONContent {
  const flat = doc?.content ?? []
  if (flat.some((node) => node.type === PAGE)) return doc as JSONContent
  const pages: JSONContent[][] = [[]]
  for (const node of flat) {
    if (node.type === 'horizontalRule') pages.push([])
    else pages.at(-1)!.push(node)
  }
  return {
    ...doc,
    type: 'doc',
    content: pages.map((blocks) => ({
      type: PAGE,
      content: blocks.length ? blocks : [{ type: 'paragraph' }],
    })),
  }
}

export function toFlat(doc: JSONContent): JSONContent {
  if (!doc.content?.some((node) => node.type === PAGE)) return doc
  const content: JSONContent[] = []
  doc.content.forEach((page, index) => {
    if (index > 0) content.push({ type: 'horizontalRule' })
    // An untouched empty page keeps its break but adds no blank paragraph.
    const blocks = page.content ?? []
    const blank =
      blocks.length === 1 && blocks[0].type === 'paragraph' && !blocks[0].content?.length
    if (!blank) content.push(...blocks)
  })
  return { ...doc, content }
}
