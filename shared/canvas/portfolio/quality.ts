import { densityReport, type DensityReport, type ImageSize, type PageMetrics } from '../density.ts'
import { fitOf } from '../fit.ts'
import { walkNodes, type CanvasDocument, type Sheet, type TextFrame } from '../model.ts'
import { lineCount } from './measure.ts'
import { ENTRY, TEMPLATE_ID, rowLines } from './tokens.ts'

/**
 * Quality of a portfolio canvas, read from its sheets alone (no stored page content), so the
 * report works on a canvas the author has edited. An entry's fill is the lines its rows use over
 * the lines the template budgets for them. Browser-safe.
 */
export const isPortfolio = (canvas: Pick<CanvasDocument, 'template'>) =>
  canvas.template?.id === TEMPLATE_ID

export type PortfolioKind = 'cover' | 'entry' | 'sources'

/** What a sheet is, from the slots its frames carry (frame ids end in the slot's name). */
export function portfolioKind(sheet: Sheet): PortfolioKind | null {
  const has = (part: string) => sheet.frames.some((f) => f.id.includes(part))
  if (has('-cover-title')) return 'cover'
  if (has('-entry-title')) return 'entry'
  if (has('-sources-title')) return 'sources'
  return null
}

const textOf = (frame: TextFrame) => {
  const out: string[] = []
  walkNodes(frame.doc, (n) => {
    if (n.type === 'text') out.push(String((n as { text?: unknown }).text ?? ''))
  })
  return out.join('')
}

/** Lines used by the body frames of an entry sheet, over the lines budgeted for its rows. */
export function entrySheetFill(sheet: Sheet): { fill: number; rows: number } {
  const bodies = sheet.frames.filter(
    (f): f is TextFrame => f.kind === 'text' && /-entry-rows-\d+-body$/.test(f.id)
  )
  if (!bodies.length) return { fill: 0, rows: 0 }
  const budgets = rowLines(bodies.length)
  const wide = bodies.some((f) => f.geo.w > 2000)
  const width = wide ? 493.5 : ENTRY.rowsW
  const used = bodies.reduce(
    (n, f, i) => n + Math.min(lineCount(textOf(f), width, 'rowBody'), budgets[i]),
    0
  )
  return {
    fill: Number((used / budgets.reduce((a, b) => a + b, 0)).toFixed(3)),
    rows: bodies.length,
  }
}

export type PortfolioPage = PageMetrics & { portfolio: PortfolioKind | null; rows: number }

/** The density report with every entry sheet marked as a content page and given its fill. */
export function portfolioReport(
  canvas: CanvasDocument,
  options: { images?: ReadonlyMap<string, ImageSize> } = {}
): Omit<DensityReport, 'pages'> & { pages: PortfolioPage[] } {
  const report = densityReport(canvas, options)
  const pages = report.pages.map((m, i): PortfolioPage => {
    const kind = portfolioKind(canvas.sheets[i])
    if (kind !== 'entry') return { ...m, portfolio: kind, rows: 0 }
    const { fill, rows } = entrySheetFill(canvas.sheets[i])
    return { ...m, kind: 'content', fill, fit: fitOf(fill), portfolio: kind, rows }
  })
  const entries = pages.filter((p) => p.portfolio === 'entry')
  return {
    ...report,
    pages,
    avgFill: entries.length
      ? Number((entries.reduce((n, p) => n + (p.fill ?? 0), 0) / entries.length).toFixed(3))
      : 0,
  }
}

export type PortfolioThresholds = { minFill: number; minCitations: number; minRows: number }
export const PORTFOLIO_THRESHOLDS: PortfolioThresholds = {
  minFill: 0.7,
  minCitations: 2,
  minRows: ENTRY.minRows,
}

export type PortfolioProblem = { page: number; id: string; code: string; message: string }

/** What an entry page falls short of; the cover and the sources pages have nothing to measure. */
export function portfolioProblems(
  page: PortfolioPage,
  thresholds: PortfolioThresholds = PORTFOLIO_THRESHOLDS
): PortfolioProblem[] {
  if (page.portfolio !== 'entry') return []
  const found: PortfolioProblem[] = []
  const add = (code: string, message: string) =>
    found.push({ page: page.index + 1, id: page.id, code, message })
  if (page.rows < thresholds.minRows) add('rows', `${page.rows} rows, under ${thresholds.minRows}`)
  if (page.fill !== null && page.fill < thresholds.minFill)
    add(
      'fill',
      `${Math.round(page.fill * 100)}% of its row space used, under ${Math.round(thresholds.minFill * 100)}%`
    )
  if (page.citations < thresholds.minCitations)
    add('citations', `${page.citations} citations, under ${thresholds.minCitations}`)
  return found
}
