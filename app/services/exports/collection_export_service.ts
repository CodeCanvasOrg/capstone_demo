import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { Exception } from '@adonisjs/core/exceptions'
import pdfWorkerConfig from '#config/pdf_worker'
import CollectionService from '#services/layout/collection_service'
import DocumentExportService from '#services/exports/document_export_service'
import ExportPdfService from '#services/exports/pdf_service'
import { renderPageHtml } from '#services/exports/collection_html'
import { type WorkspaceAccessContext } from '#services/workspaces/access_service'
import { effectiveDesign } from '../../../shared/layout/collection.ts'
import { planPages, validateDesign } from '../../../shared/layout/portfolio.ts'
import { getBrandKit } from '../../../shared/layout/brand.ts'

const run = promisify(execFile)
const script = (name: string) => path.join(path.dirname(pdfWorkerConfig.script), name)
const python = (args: string[]) =>
  run(pdfWorkerConfig.python, ['-I', ...args], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 })

/** Sheet counts of PDF files, in the order given. */
const sheets = async (files: string[]) => {
  const { stdout } = await python([script('merge_pdfs.py'), 'count', ...files])
  return JSON.parse(stdout) as number[]
}

const unsettled = (what: string) =>
  new Exception(`The collection could not be paginated: ${what}.`, {
    status: 422,
    code: 'E_COLLECTION_PAGINATION',
  })

/**
 * Composes one collection PDF from the portfolio design: its pages in order,
 * with each pinned entry where the design puts it. Entries are rendered first
 * so the contents shows their measured page counts. A preview is watermarked per entry; the final
 * download requires a current approval and renders without the watermark.
 */
export default class CollectionExportService {
  async render(
    context: WorkspaceAccessContext,
    id: string,
    { final }: { final: boolean }
  ): Promise<Buffer> {
    const collections = new CollectionService()
    if (final) await collections.assertPublishable(context, id)
    const { manifest } = await collections.get(context, id)
    const brand = getBrandKit(manifest.brand.id, manifest.brand.version)
    if (!brand) throw unsettled('its brand version is unavailable')

    const dir = await mkdtemp(path.join(tmpdir(), 'collection-'))
    try {
      const write = async (name: string, data: Buffer | string) => {
        const file = path.join(dir, name)
        await writeFile(file, data)
        return file
      }
      const entryFiles: string[] = []
      for (const [index, entry] of manifest.entries.entries())
        entryFiles.push(
          await write(
            `entry-${index}.pdf`,
            (await new DocumentExportService().preview(context, entry.entryId, 'pdf', {
              versionId: entry.revisionId,
              final,
            })) as Buffer
          )
        )
      const counts = await sheets(entryFiles)
      const measured = manifest.entries.map((entry, index) => ({ ...entry, pages: counts[index] }))

      // The design decides every page and its order; entries only supply their length.
      const design = effectiveDesign(
        { design: manifest.design, wrapper: manifest.wrapper },
        measured
      )
      const problems = validateDesign(design, measured, manifest.wrapper)
      if (problems.length) throw unsettled(problems[0].message.replace(/\.$/, ''))
      const plan = planPages(design, measured)

      const files = new Map<string, string>()
      const ctx = { manifest, brand, rows: plan.rows }
      for (const page of plan.pages) {
        if (page.kind === 'entry') {
          files.set(
            page.id,
            entryFiles[measured.findIndex((e) => e.entryId === page.entry!.entryId)]
          )
          continue
        }
        files.set(
          page.id,
          await write(
            `${page.id.replace(/[^a-z0-9-]/gi, '_')}.pdf`,
            Buffer.from(await ExportPdfService.fromHtml(await renderPageHtml(page, ctx)))
          )
        )
      }
      // Every portfolio page must take exactly the sheets the plan gave it, or the contents is wrong.
      const own = plan.pages.filter((page) => page.kind !== 'entry')
      const ownCounts = await sheets(own.map((page) => files.get(page.id)!))
      own.forEach((page, index) => {
        if (ownCounts[index] !== page.count)
          throw unsettled(
            page.kind === 'contents'
              ? 'the contents length changed while rendering'
              : `the ${page.kind} page does not fit one sheet`
          )
      })

      const toc = plan.rows.map((row) => [row.title, row.page])
      const tocFile = await write('toc.json', JSON.stringify(toc))
      const out = path.join(dir, 'collection.pdf')
      await python([
        script('merge_pdfs.py'),
        'merge',
        out,
        tocFile,
        ...plan.pages.map((page) => files.get(page.id)!),
      ])
      return await readFile(out)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
}
