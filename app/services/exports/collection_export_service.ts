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
import { renderWrapperHtml } from '#services/exports/collection_html'
import { type WorkspaceAccessContext } from '#services/workspaces/access_service'
import { composeContents } from '../../../shared/layout/collection.ts'
import { getBrandKit } from '../../../shared/layout/brand.ts'

const run = promisify(execFile)
const script = (name: string) => path.join(path.dirname(pdfWorkerConfig.script), name)
const python = (args: string[]) =>
  run(pdfWorkerConfig.python, ['-I', ...args], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 })

const unsettled = (what: string) =>
  new Exception(`The collection could not be paginated: ${what}.`, {
    status: 422,
    code: 'E_COLLECTION_PAGINATION',
  })

/**
 * Composes one collection PDF: cover, optional introduction, contents, each
 * pinned entry, back cover. Entries are rendered first so the contents shows
 * their measured page counts. A preview is watermarked per entry; the final
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
      const counts = JSON.parse(
        (await python([script('merge_pdfs.py'), 'count', ...entryFiles])).stdout
      ) as number[]
      const measured = manifest.entries.map((entry, index) => ({ ...entry, pages: counts[index] }))

      const about = !!manifest.wrapper.about
      const contents = composeContents(measured, { about })
      if (!contents.converged) throw unsettled('contents page numbers did not settle')
      // The contents lists entries grouped by category, so files follow that order.
      const order = contents.rows.map((row) => measured.findIndex((e) => e.entryId === row.entryId))

      const part = async (name: 'cover' | 'about' | 'contents' | 'back') =>
        write(
          `${name}.pdf`,
          Buffer.from(
            await ExportPdfService.fromHtml(
              await renderWrapperHtml(name, manifest, brand, contents.rows)
            )
          )
        )
      const front = [
        await part('cover'),
        ...(about ? [await part('about')] : []),
        await part('contents'),
      ]
      const frontCounts = JSON.parse(
        (await python([script('merge_pdfs.py'), 'count', ...front])).stdout
      ) as number[]
      if (frontCounts[0] !== 1 || (about && frontCounts[1] !== 1))
        throw unsettled('the cover or introduction does not fit one page')
      if (frontCounts.at(-1) !== contents.contentsPages)
        throw unsettled('the contents length changed while rendering')

      const toc = contents.rows.map((row) => [row.title, row.page])
      const tocFile = await write('toc.json', JSON.stringify(toc))
      const out = path.join(dir, 'collection.pdf')
      await python([
        script('merge_pdfs.py'),
        'merge',
        out,
        tocFile,
        ...front,
        ...order.map((index) => entryFiles[index]),
        await part('back'),
      ])
      return await readFile(out)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
}
