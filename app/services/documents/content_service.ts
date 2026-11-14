import { Exception } from '@adonisjs/core/exceptions'
import { getStructuredOutput } from '#services/structured_model_output_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import PublicationContentService from '#services/documents/publication_content_service'
import type { PublicationDocument } from '../../../shared/publication/content.ts'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { documentSchema, isAllowedLinkHref } from '../../../shared/editor/schema.ts'

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
  normalize(
    value: unknown,
    { repair = false, seed }: { repair?: boolean; seed?: string } = {}
  ): TipTapDocument {
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
    const result = getStructuredOutput({ editor: true }).safeParse(
      repair ? sanitizeModelOutput(value) : value
    )
    if (!result.success)
      throw new Exception('Invalid document content', { status: 422, code: 'E_INVALID_CONTENT' })
    const { attrs, ...rest } = result.data as TipTapDocument & {
      attrs?: Record<string, unknown> | null
    }
    const parsed = rest as TipTapDocument
    const document = repair ? repairStructure(parsed) : parsed
    const visit = (node: TipTapDocument['content'][number], depth = 0) => {
      if (depth > 50) throw new Exception('Document is too deeply nested', { status: 422 })
      if (node.attrs) {
        // Editors send `nodeId: null` for blocks that have no identity yet.
        if (node.attrs.nodeId === null || node.attrs.nodeId === undefined) delete node.attrs.nodeId
        // Defaults the editor re-adds; keeping nulls would make every save look changed.
        for (const key of ['start', 'language'])
          if (node.attrs[key] === null) delete node.attrs[key]
        if (!Object.keys(node.attrs).length) delete node.attrs
      }
      for (const mark of node.marks ?? []) {
        const item = mark as { type: string; attrs?: Record<string, unknown> }
        if (item.type === 'link') {
          const href = String(item.attrs?.href ?? '')
          if (!isAllowedLinkHref(href))
            throw new Exception('Unsupported link protocol', { status: 422 })
          item.attrs = { href, target: '_blank', rel: 'noopener noreferrer' }
        } else delete item.attrs
      }
      node.content?.forEach((child) => visit(child, depth + 1))
    }
    document.content.forEach((node) => visit(node))
    // The editor's own schema is the final authority: anything it would drop or
    // reject on load is refused here instead of being silently lost on the next save.
    try {
      // A blank document is stored empty; the editor supplies its first paragraph.
      if (document.content.length) ProseMirrorNode.fromJSON(documentSchema(), document).check()
    } catch {
      throw new Exception('Invalid document content', { status: 422, code: 'E_INVALID_CONTENT' })
    }
    // Only the publication namespace survives on the root; it is validated strictly.
    if (attrs?.publication !== null && attrs?.publication !== undefined)
      return new PublicationContentService().accept(
        { ...document, attrs: { publication: attrs.publication } } as PublicationDocument,
        { seed }
      ) as TipTapDocument
    return document
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

const NODE_TYPES = new Set([
  'paragraph',
  'heading',
  'text',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'hardBreak',
  'image',
  'sourceCitation',
])
const MARK_TYPES = new Set(['bold', 'italic', 'strike', 'underline', 'code', 'link'])
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * Model output is untrusted and often almost right. Fixes what has one obvious
 * reading (string or out-of-range heading levels, `attrs: null`, unknown marks,
 * unsafe links, unknown wrapper nodes) so one slip does not discard a whole
 * draft. Anything it cannot interpret is left for schema validation to reject.
 */
export function sanitizeModelOutput(value: unknown): unknown {
  if (!isRecord(value)) return value
  return { ...value, content: cleanNodes(value.content) }
}

function cleanNodes(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return value.flatMap((node) => cleanNode(node))
}

function cleanNode(node: unknown): unknown[] {
  if (!isRecord(node)) return [node]
  const content = cleanNodes(node.content)
  // Unknown containers (tables, callouts) keep their children instead of failing.
  if (typeof node.type !== 'string' || !NODE_TYPES.has(node.type))
    return typeof node.type === 'string' && Array.isArray(content) ? content : [node]
  const out: Record<string, unknown> = { ...node, ...(content !== undefined ? { content } : {}) }
  if (isRecord(node.attrs)) {
    const attrs = { ...node.attrs }
    if (node.type === 'heading') {
      const level = Math.round(Number(attrs.level))
      attrs.level = Number.isFinite(level) ? Math.min(4, Math.max(1, level)) : 2
    }
    if (node.type === 'orderedList' && attrs.start !== undefined) {
      const start = Math.round(Number(attrs.start))
      if (Number.isFinite(start) && start >= 1) attrs.start = start
      else delete attrs.start
    }
    out.attrs = attrs
  } else {
    delete out.attrs
    if (node.type === 'heading') out.attrs = { level: 2 }
  }
  if (Array.isArray(node.marks)) {
    const marks = node.marks.filter((mark) => {
      if (!isRecord(mark) || typeof mark.type !== 'string' || !MARK_TYPES.has(mark.type))
        return false
      // An unsafe link keeps its text; it just stops being a link.
      return mark.type !== 'link' || (isRecord(mark.attrs) && isAllowedLinkHref(mark.attrs.href))
    })
    if (marks.length > 0) out.marks = marks
    else delete out.marks
  }
  return [out]
}
