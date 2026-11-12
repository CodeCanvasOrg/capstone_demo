import type { TipTapDocument } from '#services/documents/chunk_metadata_service'

type Node = TipTapDocument['content'][number]

export const PUBLICATION_PROJECTION_VERSION = 'out-01-pilot-1'

export type PublicationSource = { number: number; label: string }

export type PublicationProjection = {
  version: typeof PUBLICATION_PROJECTION_VERSION
  title: string | null
  /** First paragraph after the title; shown in the hero. */
  summary: Node | null
  body: TipTapDocument['content']
  sources: PublicationSource[]
}

const ALLOWED_ATTRS: Record<string, string[]> = {
  heading: ['level'],
  image: ['src', 'alt', 'title', 'width', 'align'],
  orderedList: ['start'],
}

/**
 * Pure, deterministic projection of a saved TipTap body into the client-safe
 * publication shape. The saved body is never modified. Internal metadata
 * (chunk text, chunk IDs, authenticated evidence URLs) is dropped; citations
 * become per-render numbers that deduplicate by evidence chunk so the same
 * source keeps one number wherever it is cited.
 */
export default class PublicationProjectionService {
  project(document: TipTapDocument): PublicationProjection {
    const numbers = new Map<string, number>()
    const sources: PublicationSource[] = []

    const reference = (node: Node): Node | null => {
      const id = node.attrs?.sourceChunkId
      if (typeof id !== 'string') return null
      let number = numbers.get(id)
      if (!number) {
        number = numbers.size + 1
        numbers.set(id, number)
        sources.push({ number, label: sourceLabel(node) })
      }
      return { type: 'reference', attrs: { number } }
    }

    const walk = (nodes: Node[] = []): Node[] =>
      nodes.flatMap((node): Node[] => {
        if (node.type === 'sourceCitation') {
          const ref = reference(node)
          return ref ? [ref] : []
        }
        const next: Node = { type: node.type }
        if (node.text !== undefined) next.text = node.text
        if (node.marks?.length) next.marks = node.marks
        const attrs = pick(node.attrs, ALLOWED_ATTRS[node.type])
        if (attrs) next.attrs = attrs
        if (node.content) next.content = collapseReferences(walk(node.content))
        return [next]
      })

    const blocks = walk(document.content)

    let title: string | null = null
    if (blocks[0]?.type === 'heading' && blocks[0].attrs?.level === 1) {
      title = plainText(blocks[0]) || null
      blocks.shift()
    }
    const summary = blocks[0]?.type === 'paragraph' ? blocks.shift()! : null

    return { version: PUBLICATION_PROJECTION_VERSION, title, summary, body: blocks, sources }
  }
}

function pick(attrs: Node['attrs'], keys?: string[]) {
  if (!attrs || !keys) return undefined
  const out: Record<string, unknown> = {}
  for (const key of keys) if (attrs[key] !== undefined && attrs[key] !== null) out[key] = attrs[key]
  return Object.keys(out).length ? out : undefined
}

function sourceLabel(node: Node) {
  const name = typeof node.attrs?.fileName === 'string' ? node.attrs.fileName : 'Source'
  const page = typeof node.attrs?.pageNumber === 'number' ? `, p. ${node.attrs.pageNumber}` : ''
  return `${name}${page}`
}

/** Drops a reference that repeats the one immediately before it. */
function collapseReferences(nodes: Node[]) {
  return nodes.filter(
    (node, index) =>
      !(
        node.type === 'reference' &&
        nodes[index - 1]?.type === 'reference' &&
        nodes[index - 1].attrs?.number === node.attrs?.number
      )
  )
}

function plainText(node: Node): string {
  return node.text ?? (node.content ?? []).map(plainText).join('')
}
