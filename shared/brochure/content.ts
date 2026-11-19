import { z } from 'zod'
import type { ClientBlock, ClientInline, ClientRenderData } from '../publication/client.ts'
import { isFigure } from '../layout/figure.ts'
import { DESIGNS, DESIGN_IDS, type DesignId } from './designs.ts'

/**
 * What a page says, and how it is stored. A page is ordinary rich text, so the
 * editor, search, citations and approval all work on it unchanged. A small
 * convention gives it shape:
 *
 *   ## Title              a section (the first heading of a document is H1)
 *   ### Heading           a card or column inside the section
 *   83% — of executives   a figure: the value, a dash, what it measures
 *   Source: ...           the page's source line
 *   - item                a bullet
 *   ---                   a page break
 *
 * A design reads whatever it needs from this shape and ignores the rest, which
 * is why switching a page's design never means rewriting it. Browser-safe.
 */

// ---------------------------------------------------------------- model output

const text = (max: number) => z.string().trim().min(1).max(max)
const paragraphSchema = z.object({
  text: text(600),
  /** Supplied source chunk ids that support this paragraph; copied, never invented. */
  chunks: z.array(z.string().min(1).max(200)).max(4).default([]),
})
const groupSchema = z.object({
  heading: text(120),
  /** A leading figure for this card, such as "83%". Its paragraph says what it measures. */
  stat: z.string().trim().min(1).max(12).optional(),
  paragraphs: z.array(paragraphSchema).max(3),
  bullets: z.array(text(120)).max(8),
})
const sectionSchema = z.object({
  title: text(120).optional(),
  paragraphs: z.array(paragraphSchema).max(6),
  /** One large figure for the section, such as ">30" and what it counts. */
  stat: z.object({ value: z.string().trim().min(1).max(12), label: text(80) }).optional(),
  bullets: z.array(text(120)).max(8),
  groups: z.array(groupSchema).max(6),
  source: text(160).optional(),
})
export const pageSchema = z.object({
  design: z.enum(DESIGN_IDS),
  sections: z.array(sectionSchema).min(1).max(3),
})
export const brochureSchema = z.object({
  pages: z.array(pageSchema).min(1).max(12),
  /** Private notes for the reviewer; never part of the pages. */
  reviewer_notes: z.array(text(300)).max(20),
})

export type Para = z.infer<typeof paragraphSchema>
export type GroupContent = z.infer<typeof groupSchema>
export type SectionContent = z.infer<typeof sectionSchema>
export type PageContent = z.infer<typeof pageSchema>
export type BrochureOutput = z.infer<typeof brochureSchema>

// ------------------------------------------------------------------- limits

type GroupCaps = {
  min: number
  max: number
  heading: number
  paragraph: number
  /** How many paragraphs a card holds; one unless stated. */
  paragraphs?: number
  bullets: number
  bullet: number
  /** Every card carries a figure. */
  stat?: boolean
}
export type SectionCaps = {
  title?: number
  /** [fewest, most, characters each] */
  paragraphs?: [number, number, number]
  stat?: { value: number; label: number }
  /** [most items, characters each] */
  bullets?: [number, number]
  groups?: GroupCaps
  source?: number
}

const G = (g: Partial<GroupCaps> & Pick<GroupCaps, 'min' | 'max'>): GroupCaps => ({
  heading: 60,
  paragraph: 0,
  bullets: 0,
  bullet: 70,
  ...g,
})

/**
 * What each design can hold, section by section. These are the limits a page is
 * written to and checked against, so detailed copy still fits its sheet.
 */
export const CAPS: Record<DesignId, SectionCaps[]> = {
  cover: [{ title: 70, paragraphs: [0, 1, 120] }],
  proof: [
    {
      title: 60,
      paragraphs: [1, 2, 150],
      groups: G({ min: 1, max: 3, heading: 24, paragraph: 170, stat: true }),
      source: 120,
    },
  ],
  article: [
    {
      title: 80,
      paragraphs: [1, 5, 260],
      bullets: [6, 80],
      groups: G({ min: 0, max: 2, heading: 80 }),
    },
  ],
  offer: [
    { title: 50, paragraphs: [1, 1, 330], stat: { value: 6, label: 60 } },
    { title: 40, groups: G({ min: 3, max: 3, heading: 36, paragraph: 330 }) },
  ],
  glance: [
    { title: 110 },
    {
      title: 30,
      paragraphs: [1, 3, 70],
      groups: G({ min: 3, max: 4, heading: 26, bullets: 6, bullet: 34 }),
    },
    {
      title: 24,
      bullets: [5, 100],
      groups: G({ min: 0, max: 1, heading: 40, bullets: 4, bullet: 80 }),
    },
  ],
  columns: [
    { title: 40, paragraphs: [1, 1, 280] },
    {
      title: 56,
      paragraphs: [0, 1, 50],
      groups: G({ min: 2, max: 3, heading: 90, paragraph: 300, bullets: 4 }),
    },
  ],
  insight: [{ groups: G({ min: 2, max: 3, heading: 90, paragraph: 340, bullets: 6 }) }],
  recognition: [
    {
      title: 70,
      paragraphs: [1, 2, 420],
      groups: G({ min: 0, max: 1, heading: 60, paragraph: 120 }),
    },
    {
      title: 30,
      groups: G({ min: 3, max: 6, heading: 70, paragraph: 110, bullets: 2, bullet: 40 }),
    },
  ],
  // The small print is the last paragraph of the About section; a heading-less section cannot follow another.
  contact: [
    { title: 24, groups: G({ min: 1, max: 1, heading: 40, paragraph: 90, paragraphs: 4 }) },
    { title: 30, paragraphs: [1, 4, 520] },
  ],
}

export type PageProblem = { code: 'too_long' | 'too_many' | 'too_few' | 'missing'; field: string }

/** Checks a written page against its design's limits. Fields are reported by path for a targeted retry. */
export function validatePage(design: DesignId, page: PageContent, index = 0): PageProblem[] {
  const found: PageProblem[] = []
  const caps = CAPS[design]
  const at = (...parts: (string | number)[]) => [`pages[${index}]`, ...parts].join('.')
  const long = (field: string, value: string | undefined, max: number) => {
    if (value && value.length > max) found.push({ code: 'too_long', field })
  }
  const count = (field: string, n: number, min: number, max: number) => {
    if (n > max) found.push({ code: 'too_many', field })
    if (n < min) found.push({ code: 'too_few', field })
  }
  caps.forEach((cap, s) => {
    const written = page.sections[s]
    if (!written) {
      if (cap.title || cap.paragraphs?.[0] || cap.groups?.min)
        found.push({ code: 'missing', field: at(`sections[${s}]`) })
      return
    }
    const where = (...parts: (string | number)[]) => at(`sections[${s}]`, ...parts)
    if (cap.title) {
      if (!written.title) found.push({ code: 'missing', field: where('title') })
      long(where('title'), written.title, cap.title)
    } else if (written.title) long(where('title'), written.title, 120)
    const [min, max, len] = cap.paragraphs ?? [0, 0, 0]
    count(where('paragraphs'), written.paragraphs.length, min, max)
    written.paragraphs.forEach((p, i) => long(where(`paragraphs[${i}]`), p.text, len))
    if (cap.stat) {
      if (!written.stat) found.push({ code: 'missing', field: where('stat') })
      else {
        long(where('stat.value'), written.stat.value, cap.stat.value)
        long(where('stat.label'), written.stat.label, cap.stat.label)
        if (!isFigure(written.stat.value))
          found.push({ code: 'missing', field: where('stat.value') })
      }
    }
    if (cap.bullets) {
      count(where('bullets'), written.bullets.length, 0, cap.bullets[0])
      written.bullets.forEach((b, i) => long(where(`bullets[${i}]`), b, cap.bullets![1]))
    } else count(where('bullets'), written.bullets.length, 0, 0)
    if (cap.groups) {
      const g = cap.groups
      count(where('groups'), written.groups.length, g.min, g.max)
      written.groups.forEach((item, i) => {
        long(where(`groups[${i}].heading`), item.heading, g.heading)
        count(
          where(`groups[${i}].paragraphs`),
          item.paragraphs.length,
          0,
          g.paragraphs ?? (g.paragraph ? 1 : 0)
        )
        item.paragraphs.forEach((p, k) =>
          long(where(`groups[${i}].paragraphs[${k}]`), p.text, g.paragraph)
        )
        count(where(`groups[${i}].bullets`), item.bullets.length, 0, g.bullets)
        item.bullets.forEach((b, k) => long(where(`groups[${i}].bullets[${k}]`), b, g.bullet))
        if (g.stat && !(item.stat && isFigure(item.stat)))
          found.push({ code: 'missing', field: where(`groups[${i}].stat`) })
      })
    } else count(where('groups'), written.groups.length, 0, 0)
    long(where('source'), written.source, cap.source ?? 0)
    if (written.source && !cap.source) found.push({ code: 'too_many', field: where('source') })
  })
  if (page.sections.length > caps.length) found.push({ code: 'too_many', field: at('sections') })
  return found
}

// ------------------------------------------------------------- serialization

type Node = {
  type: string
  attrs?: Record<string, unknown>
  text?: string
  content?: Node[]
}

const textNode = (value: string): Node => ({ type: 'text', text: value })
const paragraphNode = (value: string, chunks: string[] = []): Node => ({
  type: 'paragraph',
  content: [
    textNode(value),
    ...chunks.map((id) => ({ type: 'sourceCitation', attrs: { sourceChunkId: id } })),
  ],
})
const headingNode = (level: number, value: string): Node => ({
  type: 'heading',
  attrs: { level },
  content: [textNode(value)],
})
const listNode = (items: string[]): Node => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [paragraphNode(item)] })),
})

export const STAT_SEPARATOR = ' — '

/**
 * Pages to an ordinary rich-text document in the convention above. Chunk ids the
 * application never supplied are dropped, never turned into citations, and the
 * caller is told so it can leave a private note.
 */
export function documentFromPages(
  pages: PageContent[],
  { allowedChunkIds = new Set<string>() }: { allowedChunkIds?: ReadonlySet<string> } = {}
) {
  let dropped = false
  const cite = (chunks: string[]) =>
    chunks.filter((id) => {
      if (allowedChunkIds.has(id)) return true
      dropped = true
      return false
    })
  const content: Node[] = []
  pages.forEach((page, p) => {
    if (p > 0) content.push({ type: 'horizontalRule' })
    page.sections.forEach((s, i) => {
      // The document's first heading is its title; every other section is a second-level heading.
      if (s.title) content.push(headingNode(p === 0 && i === 0 ? 1 : 2, s.title))
      s.paragraphs
        .slice(0, 1)
        .forEach((item) => content.push(paragraphNode(item.text, cite(item.chunks))))
      if (s.stat) content.push(paragraphNode(`${s.stat.value}${STAT_SEPARATOR}${s.stat.label}`))
      s.paragraphs
        .slice(1)
        .forEach((item) => content.push(paragraphNode(item.text, cite(item.chunks))))
      if (s.bullets.length) content.push(listNode(s.bullets))
      for (const g of s.groups) {
        content.push(headingNode(3, g.heading))
        g.paragraphs.forEach((item, k) =>
          content.push(
            paragraphNode(
              k === 0 && g.stat ? `${g.stat}${STAT_SEPARATOR}${item.text}` : item.text,
              cite(item.chunks)
            )
          )
        )
        if (g.bullets.length) content.push(listNode(g.bullets))
      }
      if (s.source) content.push(paragraphNode(`Source: ${s.source}`))
    })
  })
  return { document: { type: 'doc' as const, content }, dropped }
}

// ------------------------------------------------------------------- parsing

export type ListBlock = Extract<ClientBlock, { type: 'bulletList' | 'orderedList' }>
export type ParagraphBlock = Extract<ClientBlock, { type: 'paragraph' }>
export type ParsedGroup = {
  heading: string
  stat?: string
  paragraphs: ParagraphBlock[]
  lists: ListBlock[]
  bullets: string[]
}
export type ParsedSection = {
  title?: string
  paragraphs: ParagraphBlock[]
  stat?: { value: string; label: string }
  lists: ListBlock[]
  /** Plain text of every bullet, in order. */
  bullets: string[]
  groups: ParsedGroup[]
  source?: string
  /** Anything the convention has no place for, shown after the rest rather than dropped. */
  extra: ClientBlock[]
}

type Inline = { type: string; text?: string; content?: Inline[] }
export const plainText = (nodes: Inline[] | readonly ClientInline[] | undefined): string =>
  ((nodes ?? []) as Inline[])
    .map((node) => (node.type === 'text' ? (node.text ?? '') : plainText(node.content)))
    .join('')

const itemsOf = (list: ListBlock) =>
  list.content.map((item) =>
    item.content
      .map((child) => ('content' in child ? plainText(child.content as Inline[]) : ''))
      .join(' ')
      .trim()
  )

const STAT = /^(\S{1,12})\s+—\s+/
const SOURCE = /^Source:\s*/i

/** A paragraph that opens with a figure, a dash and its meaning. */
function leadingStat(block: ParagraphBlock) {
  const first = block.content?.[0]
  if (first?.type !== 'text') return null
  const match = STAT.exec(first.text)
  if (!match || !isFigure(match[1])) return null
  const rest: ParagraphBlock = {
    type: 'paragraph',
    content: [
      { ...first, text: first.text.slice(match[0].length) },
      ...(block.content?.slice(1) ?? []),
    ],
  }
  return { value: match[1], rest }
}

export function parseSections(blocks: ClientBlock[]): ParsedSection[] {
  const sections: ParsedSection[] = []
  let current: ParsedSection | undefined
  let group: ParsedGroup | undefined
  const ensure = () =>
    (current ??=
      sections[
        sections.push({
          paragraphs: [],
          lists: [],
          bullets: [],
          groups: [],
          extra: [],
        }) - 1
      ])
  for (const block of blocks) {
    if (block.type === 'heading' && block.level <= 2) {
      current = undefined
      group = undefined
      ensure().title = plainText(block.content) || undefined
    } else if (block.type === 'heading') {
      const section = ensure()
      group = { heading: plainText(block.content), paragraphs: [], lists: [], bullets: [] }
      section.groups.push(group)
    } else if (block.type === 'paragraph') {
      const section = ensure()
      const lead = leadingStat(block)
      const plain = plainText(block.content)
      if (SOURCE.test(plain)) section.source = plain.replace(SOURCE, '').trim()
      else if (lead && group && group.stat === undefined && !group.paragraphs.length) {
        group.stat = lead.value
        if (plainText(lead.rest.content).trim()) group.paragraphs.push(lead.rest)
      } else if (lead && !group && !section.stat)
        section.stat = { value: lead.value, label: plainText(lead.rest.content).trim() }
      else (group ?? section).paragraphs.push(block)
    } else if (block.type === 'bulletList' || block.type === 'orderedList') {
      const section = ensure()
      const target = group ?? section
      target.lists.push(block)
      target.bullets.push(...itemsOf(block))
    } else if (block.type !== 'horizontalRule') ensure().extra.push(block)
  }
  return sections
}

/**
 * The pages of an entry. The title and summary open the first page; a page
 * break starts each later one. Empty pages are not pages.
 */
export function splitPages(
  client: Pick<ClientRenderData, 'title' | 'summary' | 'body'>
): ClientBlock[][] {
  const lead: ClientBlock[] = [
    ...(client.title
      ? [
          {
            type: 'heading' as const,
            level: 1 as const,
            content: [{ type: 'text' as const, text: client.title }],
          },
        ]
      : []),
    ...(client.summary ? [client.summary] : []),
  ]
  const pages: ClientBlock[][] = [[...lead]]
  for (const block of client.body) {
    if (block.type === 'horizontalRule') pages.push([])
    else pages.at(-1)!.push(block)
  }
  return pages.filter((page) => page.length)
}

export const parsePages = (client: Pick<ClientRenderData, 'title' | 'summary' | 'body'>) =>
  splitPages(client).map(parseSections)

/**
 * Plain-language warnings for a page whose text has grown past what its design holds,
 * for example after an edit. They are advice: the design keeps what fits, so the author
 * needs to know before anything is cut.
 */
export function lengthWarnings(design: DesignId, sections: ParsedSection[], page = 1): string[] {
  const out: string[] = []
  const caps = CAPS[design]
  const label = DESIGNS[design].label
  const warn = (value: string, max: number) => {
    if (max > 0 && value.length > max * 1.1)
      out.push(
        `Page ${page} (${label}): "${value.slice(0, 40).trim()}…" is longer than this design holds (${max} characters), so it may be cut.`
      )
  }
  const count = (what: string, n: number, max: number) => {
    if (n > max)
      out.push(`Page ${page} (${label}) shows ${max} ${what} at most; ${n - max} will not appear.`)
  }
  caps.forEach((cap, s) => {
    const section = sections[s]
    if (!section) return
    if (cap.title && section.title) warn(section.title, cap.title)
    section.paragraphs.forEach((p) => warn(plainText(p.content), cap.paragraphs?.[2] ?? 0))
    if (cap.groups) {
      count('cards', section.groups.length, cap.groups.max)
      section.groups.forEach((g) => {
        warn(g.heading, cap.groups!.heading)
        g.paragraphs.forEach((p) => warn(plainText(p.content), cap.groups!.paragraph))
        count('bullets per card', g.bullets.length, cap.groups!.bullets || g.bullets.length)
      })
    }
    if (cap.bullets) count('bullets', section.bullets.length, cap.bullets[0])
  })
  count('sections', sections.length, caps.length)
  return out
}
