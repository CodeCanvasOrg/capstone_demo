import type {
  ClientBlock,
  ClientRenderData,
  ClientResult,
  ClientSource,
} from '../publication/client.ts'
import type { BrandKit } from './brand.ts'
import {
  resolveOptions,
  type BlockType,
  type LayoutOptions,
  type TemplateDefinition,
} from './templates.ts'

/**
 * Deterministic projection of client content into template blocks (TPL-03).
 * Code chooses which blocks exist; the model never supplies layout. Empty
 * optional blocks are not emitted, so nothing reserves whitespace.
 */
export type StatItem = {
  value: string
  label: string
  qualifier: ClientResult['qualifier']
  /** "Up to" / "At least" stay as visible text beside the value. */
  prefix?: string
  context?: string
}

type Base = { id: string; fontPt: number }
export type PlanBlock =
  | (Base & { type: 'hero'; title?: string; summary?: Extract<ClientBlock, { type: 'paragraph' }> })
  | (Base & { type: 'results'; items: StatItem[] })
  | (Base & { type: 'text'; heading?: string; blocks: ClientBlock[] })
  | (Base & { type: 'figure'; image: Extract<ClientBlock, { type: 'image' }>; caption?: string })
  | (Base & { type: 'cta'; label: string; href: string })
  | (Base & { type: 'sources'; items: ClientSource[] })

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

const QUALIFIER_LABELS = {
  measured: 'Measured',
  estimated: 'Estimated',
  client_reported: 'Client reported',
  design_target: 'Design target',
} as const
const PREFIXES = { up_to: 'Up to', at_least: 'At least' } as const

const statItem = (result: ClientResult): StatItem => {
  const context = [
    result.units,
    result.scope,
    result.baseline && `baseline: ${result.baseline}`,
    result.period,
    result.methodology,
  ]
    .filter(Boolean)
    .join('; ')
  return {
    value: result.value,
    qualifier: result.qualifier,
    label: QUALIFIER_LABELS[result.qualifier],
    ...(result.comparison && result.comparison in PREFIXES
      ? { prefix: PREFIXES[result.comparison as keyof typeof PREFIXES] }
      : {}),
    ...(context ? { context } : {}),
  }
}

const plain = (block: ClientBlock): string =>
  'content' in block && block.content
    ? (block.content as unknown[])
        .map((child) => {
          const node = child as { type: string; text?: string; content?: unknown[] }
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
  const blocks: PlanBlock[] = []

  if (data.title || data.summary)
    blocks.push({
      id: 'hero',
      type: 'hero',
      fontPt: fontOf(template, 'hero'),
      ...(data.title ? { title: data.title } : {}),
      ...(data.summary ? { summary: data.summary } : {}),
    })
  else
    findings.push({ code: 'title_missing', severity: 'error', message: 'The entry has no title.' })

  if (data.results?.length && allowed('results'))
    blocks.push({
      id: 'results',
      type: 'results',
      fontPt: fontOf(template, 'results'),
      items: data.results.map(statItem),
    })

  const figures: PlanBlock[] = []
  let sectionNumber = 0
  for (const section of splitSections(data.body)) {
    const kept: ClientBlock[] = []
    for (const block of section.blocks) {
      if (block.type === 'image') {
        if (options.imageMode !== 'without' && allowed('figure'))
          figures.push({
            id: `figure-${figures.length + 1}`,
            type: 'figure',
            fontPt: fontOf(template, 'figure'),
            image: block,
            ...(block.title || block.alt ? { caption: block.title ?? block.alt } : {}),
          })
      } else kept.push(block)
    }
    const heading = section.heading ? plain(section.heading) : undefined
    if (!kept.length && !heading) continue
    blocks.push({
      id: `text-${++sectionNumber}`,
      type: 'text',
      fontPt: fontOf(template, 'text'),
      ...(heading ? { heading } : {}),
      blocks: kept,
    })
  }
  blocks.push(...figures)

  if (options.imageMode === 'with' && !figures.length)
    findings.push({
      code: 'no_image_available',
      severity: 'warning',
      message: 'Images were requested but the entry has none; no figure is invented.',
    })

  // Only an explicitly supplied call to action is shown.
  if (options.cta && allowed('cta'))
    blocks.push({ id: 'cta', type: 'cta', fontPt: fontOf(template, 'cta'), ...options.cta })
  if (data.sources.length && allowed('sources'))
    blocks.push({
      id: 'sources',
      type: 'sources',
      fontPt: fontOf(template, 'sources'),
      items: data.sources,
    })

  return {
    template: { id: template.id, version: template.version, pageBudget: template.pageBudget },
    brand: { id: brand.id, version: brand.version },
    variant: figures.length ? 'image' : 'no-image',
    density: 'normal',
    options,
    blocks,
    findings,
  }
}
