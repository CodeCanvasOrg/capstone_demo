import { Exception } from '@adonisjs/core/exceptions'
import { getStructuredOutput } from '#services/structured_model_output_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import PublicationContentService from '#services/documents/publication_content_service'

export default class ContentService {
  /** Generated drafts must contain prose the editor can actually render. */
  normalizeGenerated(value: unknown): TipTapDocument {
    const document = this.normalize(value, { repair: true })
    const hasProse = (node: TipTapDocument['content'][number]): boolean => {
      if (node.type === 'heading' || node.type === 'sourceCitation' || node.type === 'image')
        return false
      return node.type === 'text' ? !!node.text?.trim() : (node.content ?? []).some(hasProse)
    }
    if (!document.content.some(hasProse))
      throw Object.assign(new Error('The model returned no readable body text. Try again.'), {
        status: 422,
        unusableOutput: true,
      })
    return document
  }

  /**
   * Case-study drafts pass `repair` so malformed model output stays editable;
   * user-typed rich text is left strict so malformed input is still rejected.
   */
  normalize(value: unknown, { repair = false }: { repair?: boolean } = {}): TipTapDocument {
    const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }]
    let count = 0
    while (stack.length) {
      const item = stack.pop()!
      if (item.depth > 50 || ++count > 50000)
        throw new Exception('Document is too deeply nested', { status: 422 })
      if (item.value && typeof item.value === 'object')
        for (const child of Object.values(item.value))
          stack.push({ value: child, depth: item.depth + 1 })
    }
    if (JSON.stringify(value).length > 2000000)
      throw new Exception('Document is too large', { status: 422 })
    const result = getStructuredOutput({ editor: true }).safeParse(value)
    if (!result.success)
      throw new Exception('Invalid document content', { status: 422, code: 'E_INVALID_CONTENT' })
    const parsed = result.data as TipTapDocument
    const document = repair ? repairStructure(parsed) : parsed
    const visit = (node: TipTapDocument['content'][number], depth = 0) => {
      if (depth > 50) throw new Exception('Document is too deeply nested', { status: 422 })
      for (const mark of node.marks ?? []) {
        const item = mark as { type: string; attrs?: Record<string, unknown> }
        if (item.type === 'link') {
          const href = String(item.attrs?.href ?? '')
          if (!/^(https?:\/\/|mailto:)/i.test(href))
            throw new Exception('Unsupported link protocol', { status: 422 })
          item.attrs = { href, target: '_blank', rel: 'noopener noreferrer' }
        } else delete item.attrs
      }
      node.content?.forEach((child) => visit(child, depth + 1))
    }
    document.content.forEach((node) => visit(node))
    if (document.attrs?.publication === undefined) return document
    // Ordinary edits reconcile stale anchors; structurally invalid metadata is a 422.
    const publication = new PublicationContentService()
    const reconciled = publication.reconcile(document)
    publication.assertValid(reconciled)
    return reconciled
  }
}

type Node = TipTapDocument['content'][number]
// Mirrors the editor's StarterKit schema: these are the only inline nodes.
const INLINE = new Set(['text', 'hardBreak', 'sourceCitation'])
const TEXTBLOCKS = new Set(['paragraph', 'heading'])

/**
 * Repairs nesting the editor schema rejects. Models sometimes emit citations
 * as top-level blocks or blocks inside paragraphs; ProseMirror then throws on
 * every interaction. Valid documents pass through unchanged.
 */
export function repairStructure(document: TipTapDocument): TipTapDocument {
  return { ...document, content: blocks(document.content) }
}

function blocks(nodes: Node[] = []): Node[] {
  const out: Node[] = []
  for (const node of nodes) {
    if (node.type === 'text' && !node.text) continue
    if (INLINE.has(node.type)) {
      // A stray citation or text run belongs to the paragraph it follows.
      const previous = out.at(-1)
      if (previous && TEXTBLOCKS.has(previous.type))
        previous.content = [...(previous.content ?? []), node]
      else out.push({ type: 'paragraph', content: [node] })
    } else if (node.type === 'listItem') out.push(...blocks(node.content))
    else out.push(...block(node))
  }
  return out.length ? out : [{ type: 'paragraph' }]
}

function block(node: Node): Node[] {
  if (TEXTBLOCKS.has(node.type)) {
    // Some models put prose on the block itself, alongside inline citations.
    // TipTap only renders text nodes; move it before the existing children.
    if (node.text !== undefined) {
      const { text, ...rest } = node
      node = {
        ...rest,
        content: [...(text ? [{ type: 'text', text }] : []), ...(node.content ?? [])],
      }
    }
    if (!node.content) return [{ ...node }]
    // Nested blocks are lifted out after the text they interrupted.
    let open: Node | null = { ...node, content: [] }
    const result: Node[] = [open]
    for (const child of node.content) {
      if (child.type === 'text' && !child.text) continue
      if (!INLINE.has(child.type)) {
        result.push(...blocks([child]))
        open = null
        continue
      }
      if (!open) result.push((open = { type: 'paragraph', content: [] }))
      open.content!.push(child)
    }
    // A textblock that only wrapped other blocks leaves nothing behind.
    return result.filter((item, i) => i > 0 || item.content!.length || !node.content!.length)
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const items = (node.content ?? []).flatMap((child) =>
      child.type === 'text' && !child.text
        ? []
        : [listItem(child.type === 'listItem' ? child : { type: 'listItem', content: [child] })]
    )
    return items.length ? [{ ...node, content: items }] : []
  }
  if (node.type === 'blockquote') return [{ ...node, content: blocks(node.content) }]
  if (node.type === 'codeBlock') {
    const { text: misplaced, ...rest } = node
    const text = (misplaced ?? '') + (node.content ?? []).map(textOf).join('')
    return [{ ...rest, content: text ? [{ type: 'text', text }] : [] }]
  }
  // Images and rules are leaves.
  const leaf = { ...node }
  delete leaf.content
  return [leaf]
}

function listItem(node: Node): Node {
  const content = blocks(node.content)
  return {
    ...node,
    content: content[0].type === 'paragraph' ? content : [{ type: 'paragraph' }, ...content],
  }
}

function textOf(node: Node): string {
  return node.text ?? (node.content ?? []).map(textOf).join('')
}
