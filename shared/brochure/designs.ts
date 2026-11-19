/**
 * Page designs for a brochure entry, modelled on the pages of a product
 * brochure: each design is its own composition, not a block of a shared flow.
 * An entry is a list of pages and each page has one design. The content of a
 * page is ordinary rich text (see content.ts), so any design can show any page
 * and switching a page's design never means rewriting it.
 *
 * Three ways to choose: a full template (an ordered list of designs), a design
 * for each page, or `auto`, where the model picks the design that fits the
 * project. The model always writes the content. Browser-safe.
 */
export const DESIGN_IDS = [
  'cover',
  'proof',
  'article',
  'offer',
  'glance',
  'columns',
  'insight',
  'recognition',
  'contact',
] as const
export type DesignId = (typeof DESIGN_IDS)[number]

/** A page's design, or `auto` to let the model choose the one that fits. */
export type PageDesign = DesignId | 'auto'
export const isDesign = (value: unknown): value is DesignId =>
  (DESIGN_IDS as readonly unknown[]).includes(value)

export type DesignInfo = {
  label: string
  description: string
  /** When this design is the right one. Read by the model when it chooses. */
  bestFor: string
}

export const DESIGNS: Record<DesignId, DesignInfo> = {
  cover: {
    label: 'Cover',
    description: 'Dark full-page cover with ribbon artwork, a bold title and a subtitle.',
    bestFor: 'The first page. Title and one line on what it is.',
  },
  proof: {
    label: 'Statement and proof points',
    description: 'A colour column of statements beside up to three large-number proof points.',
    bestFor:
      'A page that opens with a position and backs it with up to three figures, such as survey results or headline outcomes.',
  },
  article: {
    label: 'Article',
    description: 'A title, body text, a bullet list, an accent lead-in and a large closing line.',
    bestFor: 'Explaining the idea in plain prose. The page for the story and the argument.',
  },
  offer: {
    label: 'Offer with a big number',
    description: 'A banner with an intro, one giant number overlapping it, then three columns.',
    bestFor: 'What the work offers, led by one number that matters (a count, a percentage).',
  },
  glance: {
    label: 'At a glance',
    description: 'Cards joined by arrows, a platform band, and a comparison grid.',
    bestFor:
      'How something is put together: three or four components with their parts, and how it compares.',
  },
  columns: {
    label: 'Banner and columns',
    description: 'A banner with intro text, then up to three columns with accent headings.',
    bestFor: 'A set of capabilities or benefits that each need a heading and a short explanation.',
  },
  insight: {
    label: 'Columns with art panel',
    description: 'Up to three columns of headings, text and bullets beside a dark art panel.',
    bestFor: 'Detail that follows another page: more benefits, use cases or features, in depth.',
  },
  recognition: {
    label: 'Recognition grid',
    description: 'Large display headings, intro text and a grid of up to six proof cards.',
    bestFor: 'Credibility: awards, ratings, certifications, references or named results.',
  },
  contact: {
    label: 'Contact and about',
    description: 'Contact details, an about section and small print.',
    bestFor: 'The last page. Who to talk to and who we are.',
  },
}

export const MAX_BROCHURE_PAGES = 12

export type BrochureSource = 'template' | 'custom' | 'ai'
/**
 * What an entry pins: its page designs in order. `auto` pages are resolved by the
 * model while it writes, and the resolved list replaces them once it has.
 */
export type BrochureSelection = {
  source: BrochureSource
  /** The full template this started from, for display. */
  template?: string
  pages: PageDesign[]
}

export type BrochureTemplate = {
  id: string
  label: string
  description: string
  pages: DesignId[]
}

/** Full templates: ready-made sequences of the page designs. */
export const BROCHURE_TEMPLATES: readonly BrochureTemplate[] = [
  {
    id: 'brochure',
    label: 'Product brochure',
    description: 'All nine designs in the brochure order, from cover to contact.',
    pages: [
      'cover',
      'proof',
      'article',
      'offer',
      'glance',
      'columns',
      'insight',
      'recognition',
      'contact',
    ],
  },
  {
    id: 'overview',
    label: 'Overview',
    description: 'Cover, proof points, offer, columns and contact. Five pages.',
    pages: ['cover', 'proof', 'offer', 'columns', 'contact'],
  },
  {
    id: 'capabilities',
    label: 'Capabilities',
    description: 'Cover, offer, columns, recognition and contact. Five pages.',
    pages: ['cover', 'offer', 'columns', 'recognition', 'contact'],
  },
  {
    id: 'brief',
    label: 'Brief',
    description: 'Cover, article and contact. Three pages.',
    pages: ['cover', 'article', 'contact'],
  },
]

export const getBrochureTemplate = (id: string) =>
  BROCHURE_TEMPLATES.find((template) => template.id === id)

export const templateSelection = (id: string): BrochureSelection | undefined => {
  const template = getBrochureTemplate(id)
  return template
    ? { source: 'template', template: template.id, pages: [...template.pages] }
    : undefined
}

/**
 * The whole layout is still open: the author left it to the model and the model has not
 * chosen yet. Once it has, the saved designs are fixed and a regeneration keeps them.
 */
export const isOpenPlan = (selection: BrochureSelection) =>
  selection.source === 'ai' && selection.pages.length === 1 && selection.pages[0] === 'auto'

export type SelectionResult =
  { ok: true; selection: BrochureSelection } | { ok: false; message: string }

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * Strictly rebuilds a selection from untrusted input: unknown keys, sources and
 * designs are rejected, and the page count is bounded. Messages say what to change.
 */
export function parseSelection(input: unknown): SelectionResult {
  const fail = (message: string): SelectionResult => ({ ok: false, message })
  if (
    !isObject(input) ||
    Object.keys(input).some((key) => !['source', 'template', 'pages'].includes(key))
  )
    return fail('The page designs are malformed.')
  if (!['template', 'custom', 'ai'].includes(input.source as string))
    return fail('The page designs have an unknown source.')
  if (input.template !== undefined && !getBrochureTemplate(String(input.template)))
    return fail('Choose one of the listed templates.')
  if (
    !Array.isArray(input.pages) ||
    input.pages.length < 1 ||
    input.pages.length > MAX_BROCHURE_PAGES
  )
    return fail(`A brochure has 1 to ${MAX_BROCHURE_PAGES} pages.`)
  const pages: PageDesign[] = []
  for (const page of input.pages as unknown[]) {
    if (page !== 'auto' && !isDesign(page)) return fail('Choose a design for every page.')
    pages.push(page)
  }
  return {
    ok: true,
    selection: {
      source: input.source as BrochureSource,
      ...(input.template ? { template: String(input.template) } : {}),
      pages,
    },
  }
}

/** Findings the rules attach to a selection. They are advice, not errors: the author decides. */
export function reviewSelection(selection: BrochureSelection): string[] {
  const notes: string[] = []
  const fixed = selection.pages.filter((page): page is DesignId => page !== 'auto')
  if (fixed.includes('cover') && selection.pages[0] !== 'cover')
    notes.push('The cover works best as the first page.')
  if (fixed.includes('contact') && selection.pages.at(-1) !== 'contact')
    notes.push('The contact page works best as the last page.')
  for (const id of ['cover', 'contact'] as const)
    if (fixed.filter((page) => page === id).length > 1)
      notes.push(`Use the ${DESIGNS[id].label.toLowerCase()} design once.`)
  return notes
}

/**
 * The design each rendered page uses. An `auto` page the model has not resolved
 * (an entry whose generation has not finished) and any page beyond the list use
 * the article design, which holds any content; the first page defaults to the cover.
 */
export function resolveDesigns(pages: readonly PageDesign[], count: number): DesignId[] {
  return Array.from({ length: count }, (_, index) => {
    const wanted = pages[index]
    if (wanted && wanted !== 'auto') return wanted
    return index === 0 ? 'cover' : 'article'
  })
}
