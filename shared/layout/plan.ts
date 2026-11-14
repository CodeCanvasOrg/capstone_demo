import type {
  ClientBlock,
  ClientRenderData,
  ClientResult,
  ClientSource,
} from '../publication/client.ts'
import type { BrandKit } from './brand.ts'
import { isFigure } from './figure.ts'
import {
  resolveOptions,
  type BlockType,
  type LayoutOptions,
  type TemplateDefinition,
} from './templates.ts'

/**
 * Deterministic projection of client content into template blocks (TPL-03).
 * Code chooses which blocks exist and reads structure from the content
 * (section headings, lists); the model never supplies layout. Empty optional
 * blocks are not emitted, so nothing reserves whitespace. A block that would
 * lose a citation or formatting falls back to ordinary text instead.
 */
export type StatItem = {
  value: string
  label: string
  qualifier: ClientResult['qualifier']
  /** "Up to" / "At least" stay as visible text beside the value. */
  prefix?: string
  /** What the number measures. */
  units?: string
  /** Scope, baseline and period. */
  context?: string
  /** Footnote letter shown beside the value, with its text in the sources block. */
  marker?: string
}
export type Section = { heading?: string; blocks: ClientBlock[] }
export type HeroImage = { src: string; alt?: string }

type Base = { id: string; fontPt: number }
export type PlanBlock =
  | (Base & {
      type: 'hero'
      kicker: string
      title?: string
      summary?: Extract<ClientBlock, { type: 'paragraph' }>
      figure?: HeroImage
    })
  | (Base & { type: 'results'; items: StatItem[] })
  | (Base & { type: 'columns'; left: Section; right: Section })
  | (Base & { type: 'text'; heading?: string; blocks: ClientBlock[] })
  | (Base & {
      type: 'steps'
      heading?: string
      items: { n: string; title: string; text: string }[]
    })
  | (Base & {
      type: 'capabilities'
      heading?: string
      items: { title: string; text: string }[]
    })
  | (Base & { type: 'roadmap'; text: string })
  | (Base & { type: 'figure'; image: Extract<ClientBlock, { type: 'image' }>; caption?: string })
  | (Base & { type: 'cta'; label: string; href: string; headline?: string })
  | (Base & {
      type: 'sources'
      items: ClientSource[]
      /** Result footnotes (lettered), e.g. "a. Estimates reported in the case study". */
      notes: { marker: string; text: string }[]
    })

export type PlanFinding = {
  code: string
  severity: 'error' | 'warning'
  message: string
  blockId?: string
}

export type LayoutPlan = {
  template: { id: string; version: number; pageBudget: number }
  brand: { id: string; version: number }
  variant: 'image' | 'no-image'
  density: 'normal' | 'compact'
  options: LayoutOptions
  blocks: PlanBlock[]
  findings: PlanFinding[]
}

export const KICKER = 'CASE STUDY'

const QUALIFIER_LABELS = {
  measured: 'Measured',
  estimated: 'Estimated',
  client_reported: 'Client reported',
  design_target: 'Design target',
} as const
const PREFIXES = { up_to: 'Up to', at_least: 'At least' } as const
const MARKERS = 'abcdefghij'

const statItem = (result: ClientResult, marker?: string): StatItem => {
  const context = [result.scope, result.baseline && `baseline: ${result.baseline}`, result.period]
    .filter(Boolean)
    .join('; ')
  return {
    value: result.value,
    qualifier: result.qualifier,
    label: QUALIFIER_LABELS[result.qualifier],
    ...(result.comparison && result.comparison in PREFIXES
      ? { prefix: PREFIXES[result.comparison as keyof typeof PREFIXES] }
      : {}),
    ...(result.units ? { units: result.units } : {}),
    ...(context ? { context } : {}),
    ...(marker ? { marker } : {}),
  }
}

type Inline = { type: string; text?: string; content?: Inline[] }
const plain = (block: ClientBlock): string =>
  'content' in block && block.content
    ? (block.content as unknown[])
        .map((child) => {
          const node = child as Inline
          if (node.type === 'text') return node.text ?? ''
          return node.content ? plain(node as unknown as ClientBlock) : ''
        })
        .join('')
    : ''

/** Splits the body at headings: an initial headingless run, then one section per heading. */
export function splitSections(body: ClientBlock[]) {
  const sections: { heading?: ClientBlock; blocks: ClientBlock[] }[] = []
  for (const block of body) {
    if (block.type === 'heading') sections.push({ heading: block, blocks: [] })
    else {
      if (!sections.length) sections.push({ blocks: [] })
      sections.at(-1)!.blocks.push(block)
    }
  }
  return sections
}

const ROLE = {
  results: /^(?:key )?results\b/i,
  challenge: /^(?:the )?challenge\b/i,
  solution: /^(?:the )?solution\b/i,
  steps: /^(?:how it works|steps|process)\b/i,
  capabilities: /^(?:key )?capabilities\b/i,
  roadmap: /^(?:roadmap|next steps)\b/i,
} as const

/** Items of a plain-text list, or null when any item has a citation or other inline structure. */
function plainItems(block: ClientBlock | undefined): string[] | null {
  if (!block || (block.type !== 'orderedList' && block.type !== 'bulletList')) return null
  const items: string[] = []
  for (const item of block.content) {
    if (item.content.length !== 1 || item.content[0].type !== 'paragraph') return null
    const paragraph = item.content[0]
    if (paragraph.content?.some((node) => node.type !== 'text')) return null
    const value = plain(paragraph).trim()
    if (!value) return null
    items.push(value)
  }
  return items.length ? items : null
}

/** "Title — text" (or "Title: text"); with no separator the whole line is the title. */
function splitItem(value: string) {
  const dash = value.indexOf(' — ')
  if (dash > 0) return { title: value.slice(0, dash).trim(), text: value.slice(dash + 3).trim() }
  const colon = value.indexOf(': ')
  if (colon > 0 && colon < 60)
    return { title: value.slice(0, colon).trim(), text: value.slice(colon + 2).trim() }
  return { title: value, text: '' }
}

const rule = (template: TemplateDefinition, type: BlockType) =>
  template.blocks.find((block) => block.type === type)
const fontOf = (template: TemplateDefinition, type: BlockType) =>
  rule(template, type)?.baseFontPt ?? 11

export function planLayout(
  data: ClientRenderData,
  template: TemplateDefinition,
  brand: BrandKit,
  input: unknown
): LayoutPlan {
  const { options } = resolveOptions(template, input)
  const findings: PlanFinding[] = []
  const allowed = (type: BlockType) => !!rule(template, type)

  // Images: the first goes into the hero; any others become figure blocks.
  const images: Extract<ClientBlock, { type: 'image' }>[] = []
  const sections = splitSections(data.body).map((section) => ({
    heading: section.heading,
    blocks: section.blocks.filter((block) => {
      if (block.type !== 'image') return true
      if (options.imageMode !== 'without' && allowed('figure')) images.push(block)
      return false
    }),
  }))
  const [heroImage, ...moreImages] = images

  const blocks: PlanBlock[] = []
  if (data.title || data.summary)
    blocks.push({
      id: 'hero',
      type: 'hero',
      fontPt: fontOf(template, 'hero'),
      kicker: KICKER,
      ...(data.title ? { title: data.title } : {}),
      ...(data.summary ? { summary: data.summary } : {}),
      ...(heroImage
        ? { figure: { src: heroImage.src, alt: heroImage.alt ?? heroImage.title } }
        : {}),
    })
  else
    findings.push({ code: 'title_missing', severity: 'error', message: 'The entry has no title.' })

  const notes: { marker: string; text: string }[] = []
  // The band shows figures. A phrase in a value slot is left out and flagged, never shown as a stat.
  const stats = (data.results ?? []).filter((result) => isFigure(result.value))
  if (stats.length < (data.results?.length ?? 0))
    findings.push({
      code: 'non_numeric_result',
      severity: 'warning',
      message: 'A result has no figure, so it is not shown as a stat. Move it into the text.',
    })
  if (stats.length && allowed('results')) {
    const items = stats.map((result) => {
      const marker =
        result.methodology && notes.length < MARKERS.length ? MARKERS[notes.length] : undefined
      if (marker) notes.push({ marker, text: result.methodology! })
      return statItem(result, marker)
    })
    blocks.push({ id: 'results', type: 'results', fontPt: fontOf(template, 'results'), items })
  }

  const headingText = (section: (typeof sections)[number]) =>
    section.heading ? plain(section.heading).trim() : ''
  const toSection = (section: (typeof sections)[number]): Section => ({
    ...(section.heading ? { heading: headingText(section) } : {}),
    blocks: section.blocks,
  })
  let text = 0
  for (let index = 0; index < sections.length; index++) {
    const section = sections[index]
    const name = headingText(section)
    // Structured results already render as the stat band; repeating them would duplicate them.
    if (data.results?.length && ROLE.results.test(name)) continue
    const next = sections[index + 1]
    const pair =
      next &&
      allowed('columns') &&
      ((ROLE.challenge.test(name) && ROLE.solution.test(headingText(next))) ||
        (ROLE.solution.test(name) && ROLE.challenge.test(headingText(next))))
    if (pair) {
      blocks.push({
        id: 'columns',
        type: 'columns',
        fontPt: fontOf(template, 'columns'),
        left: toSection(section),
        right: toSection(next),
      })
      index++
      continue
    }
    const items = plainItems(section.blocks.length === 1 ? section.blocks[0] : undefined)
    if (ROLE.steps.test(name) && items && allowed('steps')) {
      blocks.push({
        id: 'steps',
        type: 'steps',
        fontPt: fontOf(template, 'steps'),
        heading: name,
        items: items.map((value, i) => ({
          n: String(i + 1).padStart(2, '0'),
          ...splitItem(value),
        })),
      })
      continue
    }
    if (ROLE.capabilities.test(name) && items && allowed('capabilities')) {
      blocks.push({
        id: 'capabilities',
        type: 'capabilities',
        fontPt: fontOf(template, 'capabilities'),
        heading: name,
        items: items.map(splitItem),
      })
      continue
    }
    if (
      ROLE.roadmap.test(name) &&
      allowed('roadmap') &&
      section.blocks.length &&
      section.blocks.every(
        (block) => block.type === 'paragraph' && !block.content?.some((n) => n.type !== 'text')
      )
    ) {
      blocks.push({
        id: 'roadmap',
        type: 'roadmap',
        fontPt: fontOf(template, 'roadmap'),
        text: section.blocks.map(plain).join(' ').trim(),
      })
      continue
    }
    if (!section.blocks.length && !name) continue
    blocks.push({
      id: `text-${++text}`,
      type: 'text',
      fontPt: fontOf(template, 'text'),
      ...(name ? { heading: name } : {}),
      blocks: section.blocks,
    })
  }

  moreImages.forEach((image, i) =>
    blocks.push({
      id: `figure-${i + 1}`,
      type: 'figure',
      fontPt: fontOf(template, 'figure'),
      image,
      ...(image.title || image.alt ? { caption: image.title ?? image.alt } : {}),
    })
  )
  if (options.imageMode === 'with' && !images.length)
    findings.push({
      code: 'no_image_available',
      severity: 'warning',
      message: 'Images were requested but the entry has none; no figure is invented.',
    })

  // Only an explicitly supplied call to action is shown.
  if (options.cta && allowed('cta'))
    blocks.push({ id: 'cta', type: 'cta', fontPt: fontOf(template, 'cta'), ...options.cta })
  if ((data.sources.length || notes.length) && allowed('sources'))
    blocks.push({
      id: 'sources',
      type: 'sources',
      fontPt: fontOf(template, 'sources'),
      items: data.sources,
      notes,
    })

  return {
    template: { id: template.id, version: template.version, pageBudget: template.pageBudget },
    brand: { id: brand.id, version: brand.version },
    variant: images.length ? 'image' : 'no-image',
    density: 'normal',
    options,
    blocks,
    findings,
  }
}
