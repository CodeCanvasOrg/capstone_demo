import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import CanvasTemplate from '#models/canvas_template'
import ContentService from '#services/documents/content_service'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import {
  projectionDocument,
  renderCanvasHtml,
  splitProjected,
} from '#services/exports/canvas_renderer'
import PortfolioRenderService, {
  sampleCanvas,
} from '#services/canvas/portfolio/portfolio_render_service'
import { entrySlotBudgets, coverSlotBudgets } from '../../../shared/canvas/portfolio/content.ts'
import { TEMPLATE_ID, TEMPLATE_VERSION } from '../../../shared/canvas/portfolio/tokens.ts'
import { getBrandKit } from '../../../shared/layout/brand.ts'
import { hashOf } from '../../../shared/layout/hash.ts'
import { CANVAS_SCHEMA_VERSION, type CanvasDocument } from '../../../shared/canvas/model.ts'

/** The page designs of the portfolio template, in the order of its sample document. */
export const PORTFOLIO_DESIGNS = ['cover', 'entry', 'sources'] as const
export type PortfolioDesign = (typeof PORTFOLIO_DESIGNS)[number]

export type SeedResult = {
  design: PortfolioDesign | 'portfolio'
  action: 'created' | 'updated' | 'unchanged'
  version: number
  preview: boolean
}

export type SeedSummary = { results: SeedResult[]; retired: number }

const NAMES = {
  portfolio: 'Navy and gold portfolio',
  cover: 'Portfolio cover',
  entry: 'Portfolio entry',
  sources: 'Portfolio sources',
} as const

/** The sample as one canvas, and as one one-sheet canvas per page design. */
export function templateProjects(): Record<'portfolio' | PortfolioDesign, CanvasDocument> {
  const sample = sampleCanvas()
  const page = (index: number): CanvasDocument => ({
    schemaVersion: CANVAS_SCHEMA_VERSION,
    template: sample.template,
    sheets: [sample.sheets[index]],
  })
  return { portfolio: sample, cover: page(0), entry: page(1), sources: page(2) }
}

/** What the gallery and the generator read about a template: the page designs and their text budgets. */
function slotsOf(design: 'portfolio' | PortfolioDesign) {
  return {
    template: TEMPLATE_ID,
    version: TEMPLATE_VERSION,
    designs: design === 'portfolio' ? PORTFOLIO_DESIGNS : [design],
    ...(design === 'cover' || design === 'portfolio' ? { cover: coverSlotBudgets() } : {}),
    ...(design === 'entry' || design === 'portfolio'
      ? { entry: { rows: { min: 3, max: 8 }, images: { max: 4 }, budgets: entrySlotBudgets(8) } }
      : {}),
    ...(design === 'sources' || design === 'portfolio'
      ? { sources: { referencesPerPage: 4, evidenceRows: { max: 3 } } }
      : {}),
  }
}

/**
 * A canvas as the export draws it, for a thumbnail: its text goes through the same
 * projection every export uses (there is no evidence to resolve in a template).
 */
export async function templateHtml(
  project: CanvasDocument,
  brand: NonNullable<ReturnType<typeof getBrandKit>>
) {
  const content = new ContentService().normalize(projectionDocument(project), { repair: true })
  const { client } = new PublicationProjectionService().project(content)
  return renderCanvasHtml(project, brand, { content: splitProjected(project, client.body) })
}

/**
 * Seeds the portfolio template: one `document` row (the sample: cover, entry and sources) and
 * one `sheet` row per page design. A row whose layout hash is unchanged is left alone; a changed
 * layout bumps its version. The academic system templates are retired.
 */
export default class CanvasTemplateSeeder {
  async seed({ dryRun = false, previews = true } = {}): Promise<SeedSummary> {
    const projects = templateProjects()
    const designs = ['portfolio', ...PORTFOLIO_DESIGNS] as const
    const results: SeedResult[] = []
    let thumbnails: Buffer[] | null = null
    for (const design of designs) {
      const project = projects[design]
      const projectHash = hashOf(project)
      const found = await CanvasTemplate.query()
        .whereNull('workspaceId')
        .whereNull('retiredAt')
        .where({ templateKey: TEMPLATE_ID, designId: design })
        .first()
      const unchanged = !!found && found.projectHash === projectHash
      const action: SeedResult['action'] = !found ? 'created' : unchanged ? 'unchanged' : 'updated'
      let version = found ? (unchanged ? found.version : found.version + 1) : 1
      let preview = !!found?.previewKey && unchanged
      if (!dryRun && (!unchanged || (previews && !found?.previewKey))) {
        let previewKey = unchanged ? (found?.previewKey ?? null) : null
        if (previews) {
          try {
            thumbnails ??= await new PortfolioRenderService().pages(projects.portfolio)
            const png = thumbnails[design === 'portfolio' ? 0 : PORTFOLIO_DESIGNS.indexOf(design)]
            previewKey = `canvas-templates/${TEMPLATE_ID}/${design}.v${version}.png`
            await drive
              .use()
              .put(previewKey, png, { contentType: 'image/png', visibility: 'private' })
            preview = true
          } catch (error) {
            logger.warn({ err: error, design }, 'Template preview was not rendered')
          }
        }
        const values = {
          kind: design === 'portfolio' ? ('document' as const) : ('sheet' as const),
          designId: design,
          category: 'portfolio' as const,
          templateKey: TEMPLATE_ID,
          version,
          schemaVersion: CANVAS_SCHEMA_VERSION,
          project,
          projectHash,
          slots: slotsOf(design),
          previewKey,
        }
        if (found) await found.merge(values).save()
        else await CanvasTemplate.create({ ...values, name: NAMES[design] })
      }
      if (dryRun) version = found && !unchanged ? found.version + 1 : (found?.version ?? 1)
      results.push({ design, action, version, preview })
    }
    const stale = () =>
      CanvasTemplate.query()
        .whereNull('workspaceId')
        .where('category', 'academic')
        .whereNull('retiredAt')
    const retired = dryRun
      ? Number((await stale().count('* as total'))[0].$extras.total)
      : Number((await stale().update({ retired_at: DateTime.utc().toSQL() }))[0] ?? 0)
    return { results, retired }
  }
}
