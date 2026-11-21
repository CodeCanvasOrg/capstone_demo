import type { CollectionEntry, Wrapper } from './collection.ts'

/**
 * Portfolio design: the ordered list of typed pages a collection is built from
 * (brochure redesign). A preset, the page-by-page editor and the model's
 * suggestion all produce this one shape, so they validate, hash, approve and
 * render the same way. Rendering never calls a model.
 *
 * Browser-safe: the builder UI imports this file for the same rules the server
 * enforces.
 */
export const PAGE_KINDS = [
  'cover',
  'statement',
  'highlights',
  'section',
  'contents',
  'entry',
  'contact',
] as const
export type PageKind = (typeof PAGE_KINDS)[number]

export const PRESET_IDS = ['brochure', 'showcase', 'compact', 'classic'] as const
export type PresetId = (typeof PRESET_IDS)[number]

export const STAT_QUALIFIERS = [
  'measured',
  'estimated',
  'client_reported',
  'design_target',
] as const
export const STAT_QUALIFIER_LABEL: Record<(typeof STAT_QUALIFIERS)[number], string> = {
  measured: 'Measured',
  estimated: 'Estimated',
  client_reported: 'Client reported',
  design_target: 'Design target',
}

/** A headline figure. It keeps its qualifier when it came from an entry's result. */
export type Stat = {
  value: string
  label: string
  qualifier?: (typeof STAT_QUALIFIERS)[number]
}

export type PageSpec =
  | { id: string; kind: 'cover'; variant: 'ribbons' | 'panel' | 'plain'; subtitle?: string }
  | { id: string; kind: 'statement'; variant: 'panel' | 'plain'; text?: string }
  | { id: string; kind: 'highlights'; variant: 'numbers' | 'band'; items: Stat[] }
  | { id: string; kind: 'section'; variant: 'bold' | 'plain'; title: string; text?: string }
  | { id: string; kind: 'contents'; variant: 'cards' | 'list' }
  | { id: string; kind: 'entry'; entryId: string }
  | { id: string; kind: 'contact'; variant: 'dark' | 'light'; text?: string }

export type DesignSource = 'rules' | 'preset' | 'custom' | 'ai'
export type PortfolioDesign = { source: DesignSource; preset?: PresetId; pages: PageSpec[] }

type Variant = { id: string; label: string }
export type CatalogEntry = {
  label: string
  description: string
  variants: readonly Variant[]
  /** Only one page of this kind may exist. */
  single: boolean
}

export const PAGE_CATALOG: Record<PageKind, CatalogEntry> = {
  cover: {
    label: 'Cover',
    description: 'Opens the portfolio with its name.',
    variants: [
      { id: 'ribbons', label: 'Ribbons' },
      { id: 'panel', label: 'Colour panel' },
      { id: 'plain', label: 'Plain' },
    ],
    single: true,
  },
  statement: {
    label: 'Introduction',
    description: 'A large statement about your company.',
    variants: [
      { id: 'panel', label: 'Colour panel' },
      { id: 'plain', label: 'Plain' },
    ],
    single: false,
  },
  highlights: {
    label: 'Key numbers',
    description: 'Up to four headline figures.',
    variants: [
      { id: 'numbers', label: 'Large numbers' },
      { id: 'band', label: 'Colour band' },
    ],
    single: false,
  },
  section: {
    label: 'Section opener',
    description: 'A title page that introduces a group of case studies.',
    variants: [
      { id: 'bold', label: 'Bold' },
      { id: 'plain', label: 'Plain' },
    ],
    single: false,
  },
  contents: {
    label: 'Contents',
    description: 'Every case study with its page number.',
    variants: [
      { id: 'cards', label: 'Cards' },
      { id: 'list', label: 'List' },
    ],
    single: true,
  },
  entry: {
    label: 'Case study',
    description: 'A case study at its own length.',
    variants: [],
    single: false,
  },
  contact: {
    label: 'Contact',
    description: 'Closes the portfolio with how to reach you.',
    variants: [
      { id: 'dark', label: 'Dark' },
      { id: 'light', label: 'Light' },
    ],
    single: true,
  },
}

export type PresetInfo = { id: PresetId; label: string; description: string }
export const PRESETS: readonly PresetInfo[] = [
  {
    id: 'brochure',
    label: 'Brochure',
    description:
      'Ribbon cover, introduction, key numbers, card contents and a section opener for each category.',
  },
  {
    id: 'showcase',
    label: 'Showcase',
    description: 'Colour-panel cover, introduction, card contents, then the case studies.',
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Cover, case studies and contact only. Best for a tight page budget.',
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Plain cover, introduction, list contents and case studies grouped by category.',
  },
]

export const MAX_PAGES = 80
export const CONTENTS_ROWS_PER_PAGE = 32
export const CONTENTS_CARDS_PER_PAGE = 8
export const MAX_HIGHLIGHTS = 4

const ids = {
  entry: (entryId: string) => `entry-${entryId}`,
}

/** Entries grouped by category, in the order each category first appears. */
export const groupEntries = (entries: CollectionEntry[]) => {
  const groups = new Map<string, CollectionEntry[]>()
  for (const entry of entries)
    groups.set(entry.category, [...(groups.get(entry.category) ?? []), entry])
  return groups
}

/** Up to `max` figures: the first stat of each entry that has one, without repeats. */
export function entryHighlights(entries: CollectionEntry[], max = 3): Stat[] {
  const out: Stat[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const stat = entry.stats?.[0]
    if (!stat) continue
    const key = `${stat.value}|${stat.label}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(stat)
    if (out.length === max) break
  }
  return out
}

/**
 * The rules. Deterministic: the same entries, wrapper and preset always give
 * the same pages. Statement and highlights pages exist only when there is
 * something real to show on them.
 */
export function rulesDesign(
  entries: CollectionEntry[],
  wrapper: Pick<Wrapper, 'about'>,
  preset: PresetId = 'brochure',
  source: DesignSource = 'preset'
): PortfolioDesign {
  const grouped = groupEntries(entries)
  const ordered = preset === 'compact' ? entries : [...grouped.values()].flat()
  const entry = (item: CollectionEntry): PageSpec => ({
    id: ids.entry(item.entryId),
    kind: 'entry',
    entryId: item.entryId,
  })
  const about = !!wrapper.about?.trim()
  const pages: PageSpec[] = []
  const push = (page: PageSpec) => void pages.push(page)

  switch (preset) {
    case 'classic':
      push({ id: 'cover', kind: 'cover', variant: 'plain' })
      if (about) push({ id: 'statement', kind: 'statement', variant: 'plain' })
      push({ id: 'contents', kind: 'contents', variant: 'list' })
      ordered.forEach((item) => push(entry(item)))
      push({ id: 'contact', kind: 'contact', variant: 'dark' })
      break
    case 'showcase':
      push({ id: 'cover', kind: 'cover', variant: 'panel' })
      if (about) push({ id: 'statement', kind: 'statement', variant: 'plain' })
      push({ id: 'contents', kind: 'contents', variant: 'cards' })
      ordered.forEach((item) => push(entry(item)))
      push({ id: 'contact', kind: 'contact', variant: 'dark' })
      break
    case 'compact':
      push({ id: 'cover', kind: 'cover', variant: 'plain' })
      ordered.forEach((item) => push(entry(item)))
      push({ id: 'contact', kind: 'contact', variant: 'light' })
      break
    case 'brochure': {
      push({ id: 'cover', kind: 'cover', variant: 'ribbons' })
      if (about) push({ id: 'statement', kind: 'statement', variant: 'panel' })
      const items = entryHighlights(entries)
      if (items.length >= 2)
        push({ id: 'highlights', kind: 'highlights', variant: 'numbers', items })
      push({ id: 'contents', kind: 'contents', variant: 'cards' })
      let n = 0
      for (const [category, group] of grouped) {
        if (grouped.size >= 2)
          push({ id: `section-${++n}`, kind: 'section', variant: 'bold', title: category })
        group.forEach((item) => push(entry(item)))
      }
      push({ id: 'contact', kind: 'contact', variant: 'dark' })
      break
    }
  }
  return { source, preset, pages }
}

/**
 * Keeps a design in step with the entries and wrapper copy. A rules or preset
 * design is rebuilt from its preset; a custom or model-made design keeps the
 * reviewer's pages, drops entries that were removed and adds new ones before
 * the closing page.
 */
export function reconcileDesign(
  design: PortfolioDesign,
  entries: CollectionEntry[],
  wrapper: Pick<Wrapper, 'about'>
): PortfolioDesign {
  if (design.source === 'rules' || design.source === 'preset')
    return rulesDesign(entries, wrapper, design.preset ?? 'brochure', design.source)
  const present = new Set(entries.map((entry) => entry.entryId))
  const kept = design.pages.filter((page) => page.kind !== 'entry' || present.has(page.entryId))
  const have = new Set(kept.flatMap((page) => (page.kind === 'entry' ? [page.entryId] : [])))
  const added: PageSpec[] = entries
    .filter((entry) => !have.has(entry.entryId))
    .map((entry) => ({ id: ids.entry(entry.entryId), kind: 'entry', entryId: entry.entryId }))
  const closing = kept.at(-1)?.kind === 'contact' ? kept.pop() : undefined
  return { ...design, pages: [...kept, ...added, ...(closing ? [closing] : [])] }
}

export type DesignFinding = { code: string; message: string; pageId?: string }

const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
const optionalText = (value: unknown, max: number) =>
  value === undefined || (typeof value === 'string' && value.trim().length <= max)
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const only = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key))

const variantOf = <K extends PageKind>(kind: K, value: unknown) =>
  PAGE_CATALOG[kind].variants.some((variant) => variant.id === value)

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : undefined)
const withText = <T extends object>(base: T, key: string, value: unknown): T => {
  const out = clean(value)
  return out ? { ...base, [key]: out } : base
}

/**
 * Strictly rebuilds a design from untrusted input: unknown keys, kinds and
 * variants are rejected, never stored. The stored manifest is hashed, so
 * nothing the editor or a model adds outside this shape can reach it.
 */
export function parseDesign(
  input: unknown
): { ok: true; design: PortfolioDesign } | { ok: false; errors: DesignFinding[] } {
  const errors: DesignFinding[] = []
  const fail = (code: string, message: string, pageId?: string) =>
    void errors.push({ code, message, ...(pageId ? { pageId } : {}) })
  if (!isObject(input) || !only(input, ['source', 'preset', 'pages']))
    return {
      ok: false,
      errors: [{ code: 'design_shape', message: 'The page design is malformed.' }],
    }
  const source = input.source as DesignSource
  if (!['rules', 'preset', 'custom', 'ai'].includes(source))
    fail('design_source', 'The page design has an unknown source.')
  const preset = input.preset as PresetId | undefined
  if (preset !== undefined && !(PRESET_IDS as readonly string[]).includes(preset))
    fail('design_preset', 'The page design uses an unknown preset.')
  if (!Array.isArray(input.pages) || input.pages.length === 0 || input.pages.length > MAX_PAGES)
    return {
      ok: false,
      errors: [
        ...errors,
        { code: 'design_pages', message: `A design has 1 to ${MAX_PAGES} pages.` },
      ],
    }

  const pages: PageSpec[] = []
  for (const raw of input.pages as unknown[]) {
    if (
      !isObject(raw) ||
      !text(raw.id, 64) ||
      !(PAGE_KINDS as readonly unknown[]).includes(raw.kind)
    ) {
      fail('page_shape', 'A page is malformed.')
      continue
    }
    const id = (raw.id as string).trim()
    const kind = raw.kind as PageKind
    const known = (keys: string[]) => {
      if (only(raw, ['id', 'kind', ...keys])) return true
      fail('page_shape', `A ${PAGE_CATALOG[kind].label.toLowerCase()} page has unknown fields.`, id)
      return false
    }
    const variant = () => {
      if (variantOf(kind, raw.variant)) return raw.variant as never
      fail(
        'page_variant',
        `Choose a layout for the ${PAGE_CATALOG[kind].label.toLowerCase()} page.`,
        id
      )
      return undefined
    }
    switch (kind) {
      case 'cover': {
        if (!known(['variant', 'subtitle'])) break
        if (!optionalText(raw.subtitle, 120))
          fail('cover_subtitle', 'The cover line is too long.', id)
        const v = variant()
        if (v) pages.push(withText({ id, kind, variant: v }, 'subtitle', raw.subtitle) as PageSpec)
        break
      }
      case 'statement': {
        if (!known(['variant', 'text'])) break
        if (!optionalText(raw.text, 1200))
          fail('statement_text', 'The introduction is too long.', id)
        const v = variant()
        if (v) pages.push(withText({ id, kind, variant: v }, 'text', raw.text) as PageSpec)
        break
      }
      case 'highlights': {
        if (!known(['variant', 'items'])) break
        const list = Array.isArray(raw.items) ? raw.items : []
        const items: Stat[] = []
        for (const item of list) {
          if (
            !isObject(item) ||
            !only(item, ['value', 'label', 'qualifier']) ||
            !text(item.value, 16) ||
            !text(item.label, 60) ||
            (item.qualifier !== undefined &&
              !(STAT_QUALIFIERS as readonly unknown[]).includes(item.qualifier))
          ) {
            fail('highlight_item', 'Each figure needs a short value and a label.', id)
            continue
          }
          items.push({
            value: (item.value as string).trim(),
            label: (item.label as string).trim(),
            ...(item.qualifier ? { qualifier: item.qualifier as Stat['qualifier'] } : {}),
          })
        }
        if (items.length < 1 || items.length > MAX_HIGHLIGHTS)
          fail('highlight_count', `Show 1 to ${MAX_HIGHLIGHTS} figures.`, id)
        const v = variant()
        if (v) pages.push({ id, kind, variant: v, items })
        break
      }
      case 'section': {
        if (!known(['variant', 'title', 'text'])) break
        if (!text(raw.title, 80)) fail('section_title', 'A section opener needs a title.', id)
        if (!optionalText(raw.text, 240)) fail('section_text', 'The section line is too long.', id)
        const v = variant()
        if (v && text(raw.title, 80))
          pages.push(
            withText(
              { id, kind, variant: v, title: (raw.title as string).trim() },
              'text',
              raw.text
            ) as PageSpec
          )
        break
      }
      case 'contents': {
        if (!known(['variant'])) break
        const v = variant()
        if (v) pages.push({ id, kind, variant: v })
        break
      }
      case 'entry': {
        if (!known(['entryId'])) break
        if (!text(raw.entryId, 64)) fail('entry_id', 'A case study page has no case study.', id)
        else pages.push({ id, kind, entryId: (raw.entryId as string).trim() })
        break
      }
      case 'contact': {
        if (!known(['variant', 'text'])) break
        if (!optionalText(raw.text, 240)) fail('contact_text', 'The closing line is too long.', id)
        const v = variant()
        if (v) pages.push(withText({ id, kind, variant: v }, 'text', raw.text) as PageSpec)
        break
      }
    }
  }
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    design: { source, ...(preset ? { preset } : {}), pages },
  }
}

/** Rules every design must meet, whoever made it. Messages say what to change. */
export function validateDesign(
  design: PortfolioDesign,
  entries: CollectionEntry[],
  wrapper: Pick<Wrapper, 'about'>
): DesignFinding[] {
  const found: DesignFinding[] = []
  const add = (code: string, message: string, pageId?: string) =>
    void found.push({ code, message, ...(pageId ? { pageId } : {}) })
  const { pages } = design

  const seenIds = new Set<string>()
  for (const page of pages) {
    if (seenIds.has(page.id)) add('duplicate_page', 'Two pages share one identity.', page.id)
    seenIds.add(page.id)
  }
  for (const kind of PAGE_KINDS)
    if (PAGE_CATALOG[kind].single && pages.filter((page) => page.kind === kind).length > 1)
      add('too_many', `Use only one ${PAGE_CATALOG[kind].label.toLowerCase()} page.`)

  if (pages.some((page) => page.kind === 'cover') && pages[0].kind !== 'cover')
    add(
      'cover_first',
      'The cover has to be the first page.',
      pages.find((p) => p.kind === 'cover')!.id
    )
  const contact = pages.findIndex((page) => page.kind === 'contact')
  if (contact >= 0 && contact !== pages.length - 1)
    add('contact_last', 'The contact page has to be the last page.', pages[contact].id)

  const wanted = new Set(entries.map((entry) => entry.entryId))
  const counts = new Map<string, number>()
  for (const page of pages)
    if (page.kind === 'entry') {
      counts.set(page.entryId, (counts.get(page.entryId) ?? 0) + 1)
      if (!wanted.has(page.entryId))
        add(
          'unknown_entry',
          'This page points at a case study that is not in the collection.',
          page.id
        )
    }
  for (const entry of entries) {
    const n = counts.get(entry.entryId) ?? 0
    if (n === 0)
      add('entry_missing', `"${entry.title}" has no page. Add it or remove it from the collection.`)
    if (n > 1) add('entry_repeated', `"${entry.title}" appears more than once.`)
  }

  for (const page of pages)
    if (page.kind === 'statement' && !(page.text?.trim() || wrapper.about?.trim()))
      add(
        'statement_empty',
        'The introduction page has no text. Write the company introduction or remove the page.',
        page.id
      )
  if (!pages.some((page) => page.kind === 'entry'))
    add('no_entries', 'Add at least one case study page.')
  return found
}

export type PlannedPage = {
  id: string
  kind: PageKind
  /** First page number of this page. */
  start: number
  /** How many sheets it takes: 1, except contents and entries. */
  count: number
  spec: PageSpec
  entry?: CollectionEntry
}

export type ContentsRow = { entryId: string; title: string; category: string; page: number }

/**
 * Packs list rows onto sheets. A category heading costs a row, and a sheet that
 * continues a category repeats its heading, so a reader never sees rows with no
 * group. The renderer and the page count both use this, so they cannot disagree.
 */
export function listSheets<T extends { category: string }>(items: T[]): T[][] {
  const sheets: T[][] = [[]]
  let used = 0
  let last: string | null = null
  for (const item of items) {
    const cost = item.category === last ? 1 : 2
    if (used + cost > CONTENTS_ROWS_PER_PAGE) {
      sheets.push([])
      used = 0
      last = null
    }
    used += item.category === last ? 1 : 2
    last = item.category
    sheets.at(-1)!.push(item)
  }
  return sheets
}

/** How many sheets the contents page needs for these entries. */
export function contentsPageCount(variant: 'cards' | 'list', entries: CollectionEntry[]): number {
  if (variant === 'cards') return Math.max(1, Math.ceil(entries.length / CONTENTS_CARDS_PER_PAGE))
  return listSheets(entries).length
}

/**
 * Walks the design and numbers every sheet. Entry lengths are whatever the
 * entries say (measured when the exporter has rendered them). Contents lists
 * entries in design order, so a section opener never changes a number by
 * surprise.
 */
export function planPages(design: PortfolioDesign, entries: CollectionEntry[]) {
  const byId = new Map(entries.map((entry) => [entry.entryId, entry]))
  const ordered = design.pages.flatMap((page) =>
    page.kind === 'entry' && byId.has(page.entryId) ? [byId.get(page.entryId)!] : []
  )
  const contents = design.pages.find((page) => page.kind === 'contents')
  const contentsPages = contents ? contentsPageCount(contents.variant, ordered) : 0

  const planned: PlannedPage[] = []
  const rows: ContentsRow[] = []
  let page = 1
  for (const spec of design.pages) {
    if (spec.kind === 'entry' && !byId.has(spec.entryId)) continue
    const entry = spec.kind === 'entry' ? byId.get(spec.entryId) : undefined
    const count = spec.kind === 'contents' ? contentsPages : entry ? entry.pages : 1
    planned.push({
      id: spec.id,
      kind: spec.kind,
      start: page,
      count,
      spec,
      ...(entry ? { entry } : {}),
    })
    if (entry)
      rows.push({ entryId: entry.entryId, title: entry.title, category: entry.category, page })
    page += count
  }
  const total = page - 1
  const entryPages = ordered.reduce((sum, entry) => sum + entry.pages, 0)
  return {
    pages: planned,
    rows,
    contentsPages,
    total,
    entryPages,
    wrapperPages: total - entryPages,
  }
}
