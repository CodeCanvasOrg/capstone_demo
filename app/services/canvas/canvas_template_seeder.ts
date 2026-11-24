import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import { chromium } from 'playwright'
import CanvasTemplate from '#models/canvas_template'
import ContentService from '#services/documents/content_service'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import {
  projectionDocument,
  renderCanvasHtml,
  splitProjected,
} from '#services/exports/canvas_renderer'
import { defaultLayout } from '#services/layout/layout_validation'
import { composeAcademicSheet, type AcademicMeta } from '../../../shared/canvas/academic/compose.ts'
import { templatePage } from '../../../shared/canvas/academic/sample.ts'
import {
  ACADEMIC_DESIGN_IDS,
  ACADEMIC_DESIGNS,
  designSlots,
  type AcademicDesignId,
} from '../../../shared/canvas/academic/designs.ts'
import { getBrandKit } from '../../../shared/layout/brand.ts'
import { hashOf } from '../../../shared/layout/hash.ts'
import { CANVAS_SCHEMA_VERSION, type CanvasDocument } from '../../../shared/canvas/model.ts'

export type SeedResult = {
  design: AcademicDesignId
  action: 'created' | 'updated' | 'unchanged'
  version: number
  preview: boolean
}

const META: AcademicMeta = {
  title: 'Document title',
  label: 'Academic report',
  keywords: ['keyword one', 'keyword two'],
  references: [{ label: 'source.pdf', pages: 'p. 1' }],
}

/** The one-sheet canvas of a design: guidance text in its slots, no pictures. */
export function templateProject(design: AcademicDesignId): CanvasDocument {
  const sheet = composeAcademicSheet(
    design === 'contents' || design === 'references'
      ? { design }
      : { design, page: templatePage(design), image: null },
    0,
    META,
    {
      contents: [
        { title: 'First page', page: 3 },
        { title: 'Second page', page: 4 },
      ],
    }
  )
  return { schemaVersion: CANVAS_SCHEMA_VERSION, sheets: [sheet] }
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

export default class CanvasTemplateSeeder {
  /** Idempotent upsert of the academic system templates. */
  async seed({ dryRun = false, previews = true } = {}): Promise<SeedResult[]> {
    const layout = defaultLayout()
    const brand = getBrandKit(layout.brandId, layout.brandVersion)
    const results: SeedResult[] = []
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
    try {
      for (const design of ACADEMIC_DESIGN_IDS) {
        const project = templateProject(design)
        const projectHash = hashOf(project)
        const slots = designSlots(design)
        const found = await CanvasTemplate.query()
          .whereNull('workspaceId')
          .where({ category: 'academic', designId: design })
          .first()
        const unchanged = !!found && found.projectHash === projectHash
        const action: SeedResult['action'] = !found
          ? 'created'
          : unchanged
            ? 'unchanged'
            : 'updated'
        let version = found ? (unchanged ? found.version : found.version + 1) : 1
        let preview = !!found?.previewKey && unchanged
        if (!dryRun && (!unchanged || (previews && !found?.previewKey))) {
          let previewKey = unchanged ? (found?.previewKey ?? null) : null
          if (previews && brand) {
            try {
              browser ??= await chromium.launch()
              const page = await browser.newPage({
                viewport: { width: 794, height: 1123 },
                deviceScaleFactor: 0.6,
              })
              await page.setContent(await templateHtml(project, brand))
              const png = await page.screenshot({
                type: 'png',
                clip: { x: 0, y: 0, width: 794, height: 1123 },
              })
              await page.close()
              previewKey = `canvas-templates/academic/${design}.v${version}.png`
              await drive
                .use()
                .put(previewKey, png, { contentType: 'image/png', visibility: 'private' })
              preview = true
            } catch (error) {
              logger.warn({ err: error, design }, 'Template preview was not rendered')
            }
          }
          const values = {
            kind: 'sheet' as const,
            designId: design,
            category: 'academic' as const,
            version,
            schemaVersion: CANVAS_SCHEMA_VERSION,
            project,
            projectHash,
            slots,
            previewKey,
          }
          if (found) await found.merge(values).save()
          else {
            // Names are unique among system templates, whatever their case.
            const taken = await CanvasTemplate.query()
              .whereNull('workspaceId')
              .whereRaw('lower(name) = ?', [ACADEMIC_DESIGNS[design].label.toLowerCase()])
              .first()
            await CanvasTemplate.create({
              ...values,
              name: taken
                ? `Academic ${ACADEMIC_DESIGNS[design].label}`
                : ACADEMIC_DESIGNS[design].label,
            })
          }
        }
        if (dryRun) version = found && !unchanged ? found.version + 1 : (found?.version ?? 1)
        results.push({ design, action, version, preview })
      }
    } finally {
      await browser?.close()
    }
    return results
  }
}
