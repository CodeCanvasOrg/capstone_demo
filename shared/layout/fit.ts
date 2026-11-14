import type { ClientBlock } from '../publication/client.ts'
import type { LayoutPlan, PlanBlock, PlanFinding } from './plan.ts'
import { getTemplate, type TemplateDefinition } from './templates.ts'

/**
 * Bounded page fitting (RND-02). Word and character counts only *estimate*;
 * `measure` lets a rendered measurement replace the estimate. The fitting
 * order is fixed: approved compact variant, then a suggested larger template
 * the user must accept, then an unresolved finding. Content is never clipped,
 * citations never hidden, and no third page is added silently.
 */
export type FitStep =
  | { kind: 'compact_variant'; applied: boolean; before: number; after: number }
  | { kind: 'suggest_template'; templateId: string; resultingUnits: number }

export type FitResult = {
  plan: LayoutPlan
  fits: boolean
  /** Pages the content needs; may exceed the budget. */
  pages: number
  /** Pages of content as a fraction (1.0 = exactly one page). */
  usedUnits: number
  steps: FitStep[]
  findings: PlanFinding[]
}

export const HEADLINE_LIMIT = 60
export const SUBHEAD_LIMIT = 160

type Inline = { type: string; text?: string; content?: Inline[] }
const textLength = (nodes: Inline[] | undefined): number =>
  (nodes ?? []).reduce((sum, node) => sum + (node.text?.length ?? 0) + textLength(node.content), 0)

/** Text lines a block occupies at a given characters-per-line. */
function blockLines(block: ClientBlock, cpl: number): number {
  switch (block.type) {
    case 'paragraph':
    case 'codeBlock':
      return Math.max(1, Math.ceil(textLength(block.content as Inline[]) / cpl)) + 0.6
    case 'heading':
      return 2
    case 'horizontalRule':
      return 1
    case 'image':
      return 14
    case 'blockquote':
      return block.content.reduce((sum, child) => sum + blockLines(child, cpl * 0.9), 0) + 0.6
    case 'bulletList':
    case 'orderedList':
      return block.content.reduce(
        (sum, item) =>
          sum +
          item.content.reduce((inner, child) => inner + blockLines(child, cpl * 0.92) - 0.6, 0) +
          0.2,
        0.6
      )
  }
}

/** Estimated lines for one plan block, scaled by its type size relative to 11 pt. */
function planBlockLines(
  block: PlanBlock,
  template: TemplateDefinition,
  fontPt: number,
  plan: LayoutPlan
): number {
  const scale = fontPt / 11
  const cpl = template.capacity.charsPerLine / scale
  const sectionLines = (section: { heading?: string; blocks: ClientBlock[] }, width: number) =>
    (section.heading ? 2 : 0) +
    section.blocks.reduce((sum, child) => sum + blockLines(child, width), 0)
  switch (block.type) {
    case 'hero': {
      // The navy band: wordmark and kicker, headline, subhead; a figure needs a taller band.
      const title = block.title ? Math.ceil(block.title.length / (cpl * 0.55)) * 1.9 * scale : 0
      const summary = block.summary ? blockLines(block.summary, cpl * (block.figure ? 0.6 : 1)) : 0
      return Math.max(title + summary + 6, block.figure ? 13 : 0)
    }
    case 'results':
      // A technical evaluation is a table with one row per metric.
      if (plan.format === 'technical') return 2 + block.items.length * 3.4
      // One band row of up to four stats; more wrap to another row.
      return 8 + Math.max(0, Math.ceil(block.items.length / 4) - 1) * 6
    case 'columns':
      return (
        Math.max(sectionLines(block.left, cpl * 0.48), sectionLines(block.right, cpl * 0.48)) *
        scale
      )
    case 'text':
      return sectionLines(block, cpl) * scale
    case 'steps':
      return (
        5 +
        Math.max(
          ...block.items.map((item) =>
            Math.ceil((item.title.length + item.text.length) / (cpl / 4))
          )
        )
      )
    case 'capabilities':
      return (
        5 +
        Math.max(...block.items.map((item) => Math.ceil(item.text.length / (cpl / 3.2)))) * scale
      )
    case 'roadmap':
      if (block.items?.length && plan.format === 'vision')
        return 5 + Math.max(...block.items.map((entry) => Math.ceil(entry.text.length / (cpl / 3))))
      return 2 + Math.ceil(block.text.length / cpl)
    case 'figure':
      return 14 + (block.caption ? 1.5 : 0)
    case 'cta':
      return 4
    case 'sources':
      return (2 + block.items.length * 0.5 + block.notes.length * 1.2) * scale
  }
}

/** Page units used (1.0 = one full page) at the plan's current density. */
export function estimateUnits(plan: LayoutPlan, template: TemplateDefinition): number {
  const lines = plan.blocks.reduce(
    (sum, block) => sum + planBlockLines(block, template, block.fontPt, plan),
    0
  )
  return lines / template.capacity.linesPerPage
}

const withDensity = (
  plan: LayoutPlan,
  template: TemplateDefinition,
  density: 'normal' | 'compact'
): LayoutPlan => ({
  ...plan,
  density,
  blocks: plan.blocks.map((block) => {
    const rule = template.blocks.find((candidate) => candidate.type === block.type)
    if (!rule) return block
    // Never below the template's declared minimum.
    const fontPt =
      density === 'compact' ? Math.max(rule.minFontPt, rule.compactFontPt) : rule.baseFontPt
    return { ...block, fontPt }
  }),
})

export function fitPlan(
  plan: LayoutPlan,
  template: TemplateDefinition,
  { measure }: { measure?: (plan: LayoutPlan) => number } = {}
): FitResult {
  const units = (candidate: LayoutPlan) =>
    measure ? measure(candidate) : estimateUnits(candidate, template)
  const budget = template.pageBudget
  const findings: PlanFinding[] = [...plan.findings]
  const steps: FitStep[] = []

  const hero = plan.blocks.find((block) => block.type === 'hero') as
    Extract<PlanBlock, { type: 'hero' }> | undefined
  if (hero?.title && hero.title.length > HEADLINE_LIMIT)
    findings.push({
      code: 'headline_long',
      severity: 'warning',
      message: `The headline is over ${HEADLINE_LIMIT} characters; shorten it for a tighter hero.`,
      blockId: 'hero',
    })
  const summaryLength = hero?.summary ? textLength(hero.summary.content as Inline[]) : 0
  if (summaryLength > SUBHEAD_LIMIT)
    findings.push({
      code: 'subhead_long',
      severity: 'warning',
      message: `The summary is over ${SUBHEAD_LIMIT} characters.`,
      blockId: 'hero',
    })

  const normal = withDensity(plan, template, 'normal')
  let current = normal
  let used = units(normal)
  if (used > budget) {
    const compact = withDensity(plan, template, 'compact')
    const compactUsed = units(compact)
    const applied = compactUsed <= budget
    steps.push({ kind: 'compact_variant', applied, before: used, after: compactUsed })
    if (applied) {
      current = compact
      used = compactUsed
    }
  }

  const fits = used <= budget
  if (!fits) {
    findings.push({
      code: 'budget_exceeded',
      severity: 'error',
      message: `Content needs about ${Math.ceil(used)} pages; this template allows ${budget}.`,
    })
    const fallback = template.fallbackTemplateId
      ? getTemplate(template.fallbackTemplateId)
      : undefined
    if (fallback && fallback.pageBudget > budget) {
      // A suggestion only: the user must accept it, and the content stays as is.
      const resulting = estimateUnits(withDensity(plan, fallback, 'normal'), fallback)
      steps.push({ kind: 'suggest_template', templateId: fallback.id, resultingUnits: resulting })
      findings.push({
        code: 'suggest_template',
        severity: 'warning',
        message: `Switch to "${fallback.title}" (up to ${fallback.pageBudget} pages) or shorten the content.`,
      })
    } else {
      findings.push({
        code: 'fit_unresolved',
        severity: 'error',
        message:
          'The content does not fit the maximum page budget. Shorten it and review the change.',
      })
    }
  }

  return {
    plan: current,
    fits,
    pages: Math.max(1, Math.ceil(used - 1e-9)),
    usedUnits: used,
    steps,
    findings,
  }
}

export type PageStat = {
  words: number
  figures: number
  kind: string
  endsWithHeading?: boolean
  clippedBlocks?: string[]
}
export type PageFinding = {
  code: 'page_budget_exceeded' | 'near_empty_page' | 'detached_heading' | 'clipped_text'
  severity: 'error' | 'warning'
  message: string
  page?: number
  blockIds?: string[]
}

const SPARSE_EXEMPT = new Set(['cover', 'divider', 'contact', 'news'])
export const NEAR_EMPTY_WORDS = 120

/** Findings from measured pages of a real PDF. Severe findings block final export. */
export function inspectPages(pages: PageStat[], { budget }: { budget?: number }): PageFinding[] {
  const found: PageFinding[] = []
  const entryPages = pages.filter((page) => page.kind === 'entry').length
  if (budget !== undefined && entryPages > budget)
    found.push({
      code: 'page_budget_exceeded',
      severity: 'error',
      message: `The entry runs to ${entryPages} pages; the budget is ${budget}.`,
    })
  pages.forEach((page, index) => {
    const number = index + 1
    if (!SPARSE_EXEMPT.has(page.kind) && page.words < NEAR_EMPTY_WORDS && page.figures === 0)
      found.push({
        code: 'near_empty_page',
        severity: 'warning',
        page: number,
        message: `Page ${number} has fewer than ${NEAR_EMPTY_WORDS} words and no figure.`,
      })
    if (page.endsWithHeading)
      found.push({
        code: 'detached_heading',
        severity: 'warning',
        page: number,
        message: `Page ${number} ends with a heading that continues on the next page.`,
      })
    if (page.clippedBlocks?.length)
      found.push({
        code: 'clipped_text',
        severity: 'error',
        page: number,
        blockIds: page.clippedBlocks,
        message: `Text is clipped on page ${number}.`,
      })
  })
  return found
}
