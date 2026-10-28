import type { JSONContent } from '@tiptap/core'
import type { SemanticBlock } from './content.ts'
export type Paragraph = Extract<SemanticBlock, { type: 'paragraph' }>
export function segments(block: Paragraph) {
  const edges = [
    ...new Set([0, block.text.length, ...(block.marks ?? []).flatMap((m) => [m.from, m.to])]),
  ].sort((a, b) => a - b)
  return edges.slice(0, -1).map((from, i) => ({
    text: block.text.slice(from, edges[i + 1]),
    marks: (block.marks ?? [])
      .filter((m) => m.from <= from && m.to >= edges[i + 1])
      .map((m) => ({ type: m.type, ...(m.type === 'link' ? { attrs: { href: m.href } } : {}) })),
  }))
}
export function paragraphToEditor(block: Paragraph): JSONContent {
  const nodes = segments(block)
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: nodes.length
          ? nodes.flatMap((n) =>
              n.text
                .split('\n')
                .flatMap((text, index) => [
                  ...(index ? [{ type: 'hardBreak' }] : []),
                  ...(text ? [{ type: 'text', text, marks: n.marks }] : []),
                ])
            )
          : undefined,
      },
    ],
  }
}
export function paragraphFromEditor(value: JSONContent): Pick<Paragraph, 'text' | 'marks'> {
  let text = ''
  const marks: NonNullable<Paragraph['marks']> = []
  const inline = (node: JSONContent) => {
    if (node.type === 'text') {
      const from = text.length
      text += node.text ?? ''
      for (const mark of node.marks ?? []) {
        if (['bold', 'italic', 'code', 'link'].includes(mark.type))
          marks.push({
            from,
            to: text.length,
            type: mark.type as 'bold' | 'italic' | 'code' | 'link',
            ...(mark.type === 'link' ? { href: String(mark.attrs?.href ?? '') } : {}),
          })
      }
    } else if (node.type === 'hardBreak') text += '\n'
    else for (const child of node.content ?? []) inline(child)
  }
  let paragraphs = 0
  const blocks = (node: JSONContent) => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      if (paragraphs++) text += '\n'
      inline(node)
    } else for (const child of node.content ?? []) blocks(child)
  }
  blocks(value)
  return { text, marks }
}
