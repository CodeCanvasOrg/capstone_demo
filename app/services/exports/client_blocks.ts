import { Node, type JSONContent } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import type { ClientBlock, ClientInline } from '../../../shared/publication/client.ts'

export const ReferenceExtension = Node.create({
  name: 'reference',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { number: { default: null } }
  },
  renderHTML({ node }) {
    return ['sup', { class: 'ref' }, String(node.attrs.number)]
  },
})

export const esc = (value: string) =>
  value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Client DTO to TipTap JSON. Its input is exclusively the closed client union. */
const inline = (node: ClientInline): JSONContent => {
  if (node.type === 'reference') return { type: 'reference', attrs: { number: node.number } }
  if (node.type === 'hardBreak') return { type: 'hardBreak' }
  return {
    type: 'text',
    text: node.text,
    ...(node.marks?.length
      ? {
          marks: node.marks.map((mark) =>
            mark.type === 'link'
              ? {
                  type: 'link',
                  attrs: { href: mark.href, target: '_blank', rel: 'noopener noreferrer' },
                }
              : { type: mark.type }
          ),
        }
      : {}),
  }
}

export const block = (node: ClientBlock): JSONContent => {
  switch (node.type) {
    case 'paragraph':
    case 'codeBlock':
      return { type: node.type, ...(node.content ? { content: node.content.map(inline) } : {}) }
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: node.level },
        ...(node.content ? { content: node.content.map(inline) } : {}),
      }
    case 'horizontalRule':
      return { type: 'horizontalRule' }
    case 'blockquote':
      return { type: 'blockquote', content: node.content.map(block) }
    case 'bulletList':
    case 'orderedList':
      return {
        type: node.type,
        ...(node.type === 'orderedList' && node.start !== undefined
          ? { attrs: { start: node.start } }
          : {}),
        content: node.content.map((item) => ({
          type: 'listItem',
          content: item.content.map(block),
        })),
      }
    case 'image': {
      const { type, ...attrs } = node
      return { type, attrs }
    }
  }
}

const extensions = [StarterKit, Image, ReferenceExtension]

/** Client blocks to HTML. The only input is the closed client union. */
export const renderBlocks = (blocks: ClientBlock[]) =>
  blocks.length
    ? generateHTML({ type: 'doc', content: blocks.map(block) } as JSONContent, extensions)
    : ''
