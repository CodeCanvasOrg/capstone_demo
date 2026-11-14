import type { ClientBlock, ClientRenderData, ClientSource } from '../publication/client.ts'
import { splitSections } from './plan.ts'

/**
 * Display footnotes (OUT-04). Internal evidence identity stays server-side;
 * the client DTO identifies a source by its label and page, so deduplication
 * and renumbering work from that. Numbers follow reading order (summary, then
 * body), so reordering sections renumbers references while every one still
 * points at the same source.
 */
export type FootnoteFinding = {
  code: 'dangling_reference' | 'uncited_source' | 'duplicate_source_number'
  number: number
}

type Node = { type: string; number?: number; content?: unknown[] } & Record<string, unknown>

const sourceKey = (source: ClientSource) => `${source.label}\u0000${source.page ?? ''}`

/** Reference numbers in reading order (summary, then body); results carry none. */
function referencesInOrder(data: ClientRenderData): number[] {
  const out: number[] = []
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    const node = value as Node
    if (node.type === 'reference' && typeof node.number === 'number') out.push(node.number)
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  if (data.summary) walk(data.summary)
  data.body.forEach(walk)
  return out
}

export function validateFootnotes(data: ClientRenderData): FootnoteFinding[] {
  const found: FootnoteFinding[] = []
  const numbers = new Set<number>()
  for (const source of data.sources) {
    if (numbers.has(source.number))
      found.push({ code: 'duplicate_source_number', number: source.number })
    numbers.add(source.number)
  }
  const cited = new Set(referencesInOrder(data))
  for (const number of cited)
    if (!numbers.has(number)) found.push({ code: 'dangling_reference', number })
  for (const source of data.sources)
    if (!cited.has(source.number)) found.push({ code: 'uncited_source', number: source.number })
  return found
}

/**
 * Rebuilds numbers by first citation. Sources with the same label and page
 * collapse to one footnote; uncited sources are not displayed. A reference
 * with no source is an error: citations are never dropped silently.
 */
export function renumberFootnotes(data: ClientRenderData): ClientRenderData {
  const byNumber = new Map(data.sources.map((source) => [source.number, source]))
  const assigned = new Map<string, number>()
  const sources: ClientSource[] = []
  const remap = new Map<number, number>()
  for (const old of referencesInOrder(data)) {
    if (remap.has(old)) continue
    const source = byNumber.get(old)
    if (!source) throw new Error(`Reference ${old} has no source`)
    const key = sourceKey(source)
    let number = assigned.get(key)
    if (!number) {
      number = sources.length + 1
      assigned.set(key, number)
      sources.push({ ...source, number })
    }
    remap.set(old, number)
  }
  const rewrite = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value
    const node = { ...(value as Node) }
    if (node.type === 'reference' && typeof node.number === 'number')
      node.number = remap.get(node.number) ?? node.number
    if (Array.isArray(node.content))
      // Citations that merged into one source must not print twice in a row ("1,1").
      node.content = node.content.map(rewrite).filter((child, i, list) => {
        const prev = list[i - 1] as Node | undefined
        const self = child as Node
        return !(
          self.type === 'reference' &&
          prev?.type === 'reference' &&
          prev.number === self.number
        )
      })
    return node
  }
  return {
    ...data,
    ...(data.summary ? { summary: rewrite(data.summary) as typeof data.summary } : {}),
    body: data.body.map((block) => rewrite(block) as ClientBlock),
    sources,
  }
}

/** Reorders heading-led sections by index permutation; content is moved, never edited. */
export function reorderSections(data: ClientRenderData, order: number[]): ClientRenderData {
  const sections = splitSections(data.body)
  const valid =
    order.length === sections.length &&
    new Set(order).size === order.length &&
    order.every((index) => Number.isInteger(index) && index >= 0 && index < sections.length)
  if (!valid) throw new Error('order must be a permutation of the section indexes')
  return {
    ...data,
    body: order.flatMap((index) => [
      ...(sections[index].heading ? [sections[index].heading!] : []),
      ...sections[index].blocks,
    ]),
  }
}
