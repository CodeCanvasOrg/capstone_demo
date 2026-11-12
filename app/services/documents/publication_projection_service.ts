import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import PublicationContentService from '#services/documents/publication_content_service'
import PublicationDiagnosticService, {
  PUBLICATION_LINT_VERSION,
  type Diagnostic,
} from '#services/documents/publication_diagnostic_service'
import type { PublicationDocument } from '../../../shared/publication/content.ts'
import {
  CLIENT_SCHEMA_VERSION,
  parseClientRenderData,
  type ClientRenderData,
  type ClientResult,
  type ClientSource,
} from '../../../shared/publication/client.ts'

type Node = TipTapDocument['content'][number]

export const PUBLICATION_PROJECTION_VERSION = 'out-03-1'

/** Private to the server: ties a projection to the exact saved input. */
export type PublicationIdentity = {
  contentHash: string
  projectorVersion: typeof PUBLICATION_PROJECTION_VERSION
  linterVersion: typeof PUBLICATION_LINT_VERSION
}

export type PublicationProjection = {
  identity: PublicationIdentity
  /** The only part that may reach a layout. */
  client: ClientRenderData
  diagnostics: Diagnostic[]
}

const SAFE_SOURCE_NAME = /^[\p{L}\p{N} .,()&'_-]{1,120}$/u

/**
 * Pure, deterministic projection of a saved TipTap body into the client DTO.
 * The saved body is never modified. The DTO is built field by field and then
 * strictly re-parsed, so internal metadata (chunk text, chunk IDs, file URLs,
 * reviewer notes) has no path into it. Citations become per-render numbers
 * that deduplicate by private evidence identity.
 *
 * Unknown nodes, marks or malformed attributes throw `ClientContentError`
 * with exact field paths rather than being dropped.
 */
export default class PublicationProjectionService {
  /** Validated semantic view, or null so documents without usable metadata stay positional. */
  private semantic(document: TipTapDocument) {
    if ((document as PublicationDocument).attrs?.publication === undefined) return null
    try {
      return new PublicationContentService().derive(document as PublicationDocument, 'projection')
    } catch {
      return null
    }
  }

  project(document: TipTapDocument): PublicationProjection {
    const numbers = new Map<string, number>()
    const sources: ClientSource[] = []

    const reference = (node: Node): Node | null => {
      const id = node.attrs?.sourceChunkId
      if (typeof id !== 'string') return null
      let number = numbers.get(id)
      if (!number) {
        number = numbers.size + 1
        numbers.set(id, number)
        sources.push(source(node, number))
      }
      return { type: 'reference', attrs: { number } }
    }

    const walk = (nodes: Node[] = []): Node[] =>
      nodes.flatMap((node): Node[] => {
        if (node.type === 'sourceCitation') {
          const ref = reference(node)
          return ref ? [ref] : []
        }
        return [node.type === 'image' ? image(node) : { ...rebuild(node), ...inner(node) }]
      })
    const inner = (node: Node): Partial<Node> =>
      node.content ? { content: collapseReferences(walk(node.content)) } : {}

    // Keep each top-level node's output so hero blocks can be found by stable ID.
    const top = document.content.map((node) => ({ id: node.attrs?.nodeId, out: walk([node]) }))
    let blocks = top.flatMap((entry) => entry.out)

    let title: string | undefined
    let summary: Node | undefined
    let results: ClientResult[] = []
    const semantic = this.semantic(document)
    if (semantic) {
      // Validated metadata decides the hero and results; the saved body is untouched.
      const hero = new Set([semantic.hero.title.nodeId, semantic.hero.summary?.nodeId])
      title = semantic.hero.title.text || undefined
      summary = top.find((entry) => entry.id === semantic.hero.summary?.nodeId)?.out[0]
      blocks = top.filter((entry) => !hero.has(entry.id as string)).flatMap((entry) => entry.out)
      // Internal result and claim IDs stay server-side; only the value, qualifier and context go out.
      results = semantic.results.map(
        ({ id, claimId, ...result }) => (void id, void claimId, result)
      ) as ClientResult[]
    } else {
      if (blocks[0]?.type === 'heading' && blocks[0].attrs?.level === 1) {
        title = plainText(blocks[0]) || undefined
        blocks.shift()
      }
      summary = blocks[0]?.type === 'paragraph' ? blocks.shift() : undefined
    }

    const client = parseClientRenderData({
      schemaVersion: CLIENT_SCHEMA_VERSION,
      docType: 'case_study',
      ...(title ? { title } : {}),
      ...(summary ? { summary: toClient(summary) } : {}),
      body: blocks.map(toClient),
      ...(results.length ? { results } : {}),
      sources,
    })

    return {
      identity: {
        // Key-order independent, so the same saved content always has the same identity.
        contentHash: new PublicationContentService().contentHash(document as PublicationDocument),
        projectorVersion: PUBLICATION_PROJECTION_VERSION,
        linterVersion: PUBLICATION_LINT_VERSION,
      },
      client,
      diagnostics: new PublicationDiagnosticService().lint(client),
    }
  }
}

/** Copies only fields the DTO knows; the strict parser rejects anything else. */
function rebuild(node: Node): Node {
  const out: Node = { type: node.type }
  if (node.text !== undefined) out.text = node.text
  if (node.marks?.length) out.marks = node.marks.map(mark)
  const attrs = pick(node.attrs, ATTRS[node.type])
  if (attrs) out.attrs = attrs
  return out
}

const ATTRS: Record<string, string[]> = {
  heading: ['level'],
  orderedList: ['start'],
  reference: ['number'],
}

function image(node: Node): Node {
  return { type: 'image', attrs: pick(node.attrs, ['src', 'alt', 'title', 'width', 'align']) ?? {} }
}

function mark(raw: unknown) {
  const item = raw as { type: string; attrs?: Record<string, unknown> }
  return item.type === 'link'
    ? { type: 'link', attrs: { href: item.attrs?.href } }
    : { type: item.type }
}

/** TipTap node (already rebuilt) to the flat DTO shape, which hoists attrs. */
function toClient(node: Node): unknown {
  const { type, text, marks, attrs, content } = node
  switch (type) {
    case 'text':
      return {
        type,
        text,
        ...(marks?.length
          ? {
              marks: (marks as Array<{ type: string; attrs?: { href?: unknown } }>).map((m) =>
                m.type === 'link' ? { type: 'link', href: m.attrs?.href } : { type: m.type }
              ),
            }
          : {}),
      }
    case 'reference':
      return { type, number: attrs?.number }
    case 'heading':
      return { type, level: attrs?.level, ...(content ? { content: content.map(toClient) } : {}) }
    case 'orderedList':
      return {
        type,
        ...(attrs?.start !== undefined ? { start: attrs.start } : {}),
        content: (content ?? []).map(toClient),
      }
    case 'image':
      return { type, ...attrs }
    default:
      return { type, ...(content ? { content: content.map(toClient) } : {}) }
  }
}

function pick(attrs: Node['attrs'], keys?: string[]) {
  if (!attrs || !keys) return undefined
  const out: Record<string, unknown> = {}
  for (const key of keys) if (attrs[key] !== undefined && attrs[key] !== null) out[key] = attrs[key]
  return Object.keys(out).length ? out : undefined
}

/**
 * Source display metadata only. A file name that is not a plain title (paths,
 * URLs, odd characters) is not salvaged with a basename; it becomes a neutral
 * "Source N" label, which is a presentation label rather than a source fact.
 */
function source(node: Node, number: number): ClientSource {
  const name = node.attrs?.fileName
  const label =
    typeof name === 'string' && SAFE_SOURCE_NAME.test(name.trim())
      ? name.trim()
      : `Source ${number}`
  const page = node.attrs?.pageNumber
  return {
    number,
    label,
    ...(typeof page === 'number' && Number.isInteger(page) && page > 0 ? { page } : {}),
  }
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
