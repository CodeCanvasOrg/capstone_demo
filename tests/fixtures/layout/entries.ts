import type {
  ClientBlock,
  ClientInline,
  ClientRenderData,
  ClientResult,
} from '../../../shared/publication/client.ts'

/** Sanitized client-DTO fixtures for layout, fitting, footnote and portfolio tests (QA-01 cases). */
export const t = (text: string, ...refs: number[]): ClientInline[] => [
  { type: 'text', text },
  ...refs.map((number) => ({ type: 'reference' as const, number })),
]
export const p = (text: string, ...refs: number[]): ClientBlock => ({
  type: 'paragraph',
  content: t(text, ...refs),
})
export const h2 = (text: string): ClientBlock => ({
  type: 'heading',
  level: 2,
  content: t(text),
})
export const bullets = (...items: string[]): ClientBlock => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem' as const, content: [p(item)] })),
})
export const image: ClientBlock = {
  type: 'image',
  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  alt: 'Customs dashboard',
  title: 'Customs dashboard',
}

const words = (count: number, seed = 'word') =>
  Array.from({ length: count }, (_, i) => `${seed}${i % 17}`).join(' ')

export const measured: ClientResult = {
  value: '42%',
  qualifier: 'measured',
  comparison: 'exact',
  units: 'reduction in clearance time',
  baseline: 'Q1 manual process',
  period: 'Q2 2026',
}
export const upTo: ClientResult = {
  value: '30%',
  qualifier: 'estimated',
  comparison: 'up_to',
  units: 'faster onboarding',
  scope: 'pilot team',
}
export const target: ClientResult = { value: '2 weeks', qualifier: 'design_target' }

/** Entry 01: image-rich, two results, three sources. */
export const entry01: ClientRenderData = {
  schemaVersion: 1,
  docType: 'case_study',
  title: 'Faster customs clearance for a regional carrier',
  summary: { type: 'paragraph', content: t('How HumbleBee AI cut clearance time.', 1) },
  body: [
    h2('Challenge'),
    p('Manual document checks slowed every shipment.', 1),
    h2('Solution'),
    p('We built a document pipeline with validation.', 2),
    bullets('Automated extraction', 'Rule-based validation', 'Exception handling queue'),
    image,
    h2('Capabilities'),
    p('Document AI, workflow orchestration and audit trails.', 3, 1),
  ],
  results: [measured, upTo],
  sources: [
    { number: 1, label: 'Customs brief', page: 2 },
    { number: 2, label: 'Architecture notes' },
    { number: 3, label: 'Delivery report', page: 7 },
  ],
}

export const noImage: ClientRenderData = {
  ...entry01,
  body: entry01.body.filter((block) => block.type !== 'image'),
}

export const noMetric: ClientRenderData = { ...entry01, results: undefined }
delete (noMetric as { results?: unknown }).results

export const estimatedOnly: ClientRenderData = { ...entry01, results: [upTo] }

export const longTitle: ClientRenderData = {
  ...entry01,
  title: `A very long headline ${words(30, 'title')}`,
}

/** 40 sources: a long source block must count toward the entry budget. */
export const longSources: ClientRenderData = {
  ...entry01,
  sources: Array.from({ length: 40 }, (_, i) => ({
    number: i + 1,
    label: `Archive document ${i + 1}`,
    page: i + 1,
  })),
}

export const sparse: ClientRenderData = {
  schemaVersion: 1,
  docType: 'case_study',
  title: 'Short entry',
  body: [h2('Challenge'), p('Brief text.')],
  sources: [],
}

/** Roughly 1,150 words: fits two pages, never one. */
export const dense: ClientRenderData = {
  ...entry01,
  body: [
    h2('Challenge'),
    ...Array.from({ length: 4 }, (_, i) => p(words(110, `c${i}`), 1)),
    h2('Solution'),
    ...Array.from({ length: 4 }, (_, i) => p(words(110, `s${i}`), 2)),
    h2('Capabilities'),
    ...Array.from({ length: 2 }, (_, i) => p(words(110, `k${i}`), 3)),
  ],
}

/** Far beyond two pages. */
export const overflowing: ClientRenderData = {
  ...entry01,
  body: [h2('Challenge'), ...Array.from({ length: 20 }, (_, i) => p(words(120, `o${i}`), 1))],
}

export const misspelled: ClientRenderData = {
  ...entry01,
  summary: { type: 'paragraph', content: t('Humblebee AI and Humble Bee AI delivered this.') },
}

const li = (...items: string[]) =>
  items.map((item) => ({ type: 'listItem' as const, content: [p(item)] }))

/** The mockup entry as the client DTO: steps, capability cards, roadmap, noted results. */
export const brandedClient: ClientRenderData = {
  schemaVersion: 1,
  docType: 'case_study',
  title: 'Automating customs documentation with local AI',
  summary: {
    type: 'paragraph',
    content: t('Computer vision and on-premise OCR that digitize invoices, packing lists and IDs.'),
  },
  body: [
    h2('The challenge'),
    p('Customs staff retyped data from scanned invoices into declaration templates.', 1),
    h2('The solution'),
    p('An MVP that runs OCR and LLM services on the client’s own servers.', 2),
    h2('How it works'),
    {
      type: 'orderedList',
      content: li(
        'Upload — Invoice, packing list or ID as image or PDF.',
        'Detect — Computer vision finds stamps, tables and field boundaries.',
        'Extract — Local OCR and LLM pull structured fields on-premise.',
        'Review and export — Staff check and edit, then export.'
      ),
    },
    h2('Key capabilities'),
    {
      type: 'bulletList',
      content: li(
        'Data stays on-premise — No cloud APIs. Names never leave the perimeter.',
        'Secure by design — Encrypted storage and individual credentials.',
        'Runs on existing servers — Lightweight models avoid GPU clusters.'
      ),
    },
    h2('Roadmap'),
    p('Automatic document classification and deeper ERP integration.'),
  ],
  results: [
    {
      value: '90%',
      qualifier: 'estimated',
      comparison: 'up_to',
      units: 'less time spent processing documents',
      methodology: 'Estimates reported in the case study; no baseline was published.',
    },
    { value: '97%', qualifier: 'client_reported', units: 'reduction in transcription errors' },
    {
      value: '1,000',
      qualifier: 'design_target',
      units: 'declarants supported by the MVP architecture',
      methodology: 'Architecture capacity target, not a measured outcome.',
    },
  ],
  sources: [
    { number: 1, label: 'Customs case study', page: 2 },
    { number: 2, label: 'Customs case study', page: 3 },
  ],
}
