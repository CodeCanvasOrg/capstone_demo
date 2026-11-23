import DocumentImage from '#models/document_image'
import type { CanvasDocument } from '../../../shared/canvas/model.ts'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import Document from '#models/document'
import Workspace from '#models/workspace'
import DocumentVersion from '#models/document_version'
import WorkspaceTask from '#models/workspace_task'
import ReadinessService, { reviewInputHash } from '#services/documents/readiness_service'
import ContentService from '#services/documents/content_service'
import EvidenceService from '#services/documents/evidence_service'
import DocumentImageService from '#services/documents/document_image_service'
import ExportPdfService from '#services/exports/pdf_service'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import { ClientContentError } from '../../../shared/publication/client.ts'
import { Exception } from '@adonisjs/core/exceptions'
import AccessService, {
  conflict,
  uuid,
  missingResource,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import TaskService, { fingerprint, type TaskLease } from '#services/workspaces/task_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import DocumentApproval from '#models/document_approval'
import BundleService from '#services/layout/bundle_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import { checkContent } from '../../../shared/layout/checks.ts'
import { fitPlan } from '../../../shared/layout/fit.ts'
import { renumberFootnotes } from '../../../shared/layout/footnotes.ts'
import { getBrandKit } from '../../../shared/layout/brand.ts'
import { planLayout } from '../../../shared/layout/plan.ts'
import { getTemplate } from '../../../shared/layout/templates.ts'
import type { ClientRenderData } from '../../../shared/publication/client.ts'
import { lengthWarnings, parsePages } from '../../../shared/brochure/content.ts'
import { resolveDesigns } from '../../../shared/brochure/designs.ts'
import { renderBrochureHtml, type BrochurePage } from '#services/exports/brochure_renderer'
import { renderWebHtml } from '#services/exports/web_renderer'
import {
  projectionDocument,
  renderCanvasHtml,
  splitProjected,
} from '#services/exports/canvas_renderer'
import CanvasService, { canvasEnabled } from '#services/canvas/canvas_service'
import type { WorkspaceAccessContext as Ctx } from '#services/workspaces/access_service'
import type { DesignId } from '../../../shared/brochure/designs.ts'

export type ExportFormat = 'pdf' | 'web'
export const EXPORT_FORMATS = {
  pdf: { extension: 'pdf', contentType: 'application/pdf' },
  web: { extension: 'html', contentType: 'text/html; charset=utf-8' },
} as const satisfies Record<ExportFormat, { extension: string; contentType: string }>
/** Tasks queued before the web format existed carry no format and are PDFs. */
export const exportFormat = (value: unknown): ExportFormat => (value === 'web' ? 'web' : 'pdf')
/** OUT-01 pilot: branded publication layout, off unless enabled. */
const publicationLayout = () => env.get('PUBLICATION_LAYOUT') === 'pilot'

/** The largest frame each document image fills on a canvas, by image id (tenths of a millimetre). */
export function imageFrameSizes(canvas: CanvasDocument) {
  const sizes = new Map<string, { w: number; h: number }>()
  for (const sheet of canvas.sheets)
    for (const frame of sheet.frames)
      if (frame.kind === 'image' && frame.imageId) {
        const seen = sizes.get(frame.imageId)
        sizes.set(frame.imageId, {
          w: Math.max(seen?.w ?? 0, frame.geo.w),
          h: Math.max(seen?.h ?? 0, frame.geo.h),
        })
      }
  return sizes
}

export default class DocumentExportService {
  async request(
    context: WorkspaceAccessContext,
    documentId: string,
    input: {
      approvalId?: string
      baseVersionId?: string
      mutationId: string
      format?: ExportFormat
    }
  ) {
    const task = await db.transaction(async (trx) => {
      await Workspace.query({ client: trx })
        .where('id', context.workspaceId)
        .forUpdate()
        .firstOrFail()
      await new AccessService().lock(context, trx)
      const doc = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      const state = await new ReadinessService().inspect(doc, trx)
      const solo = !state.reviewRequired && !input.approvalId
      if (solo) {
        if (
          !state.canExport ||
          !input.baseVersionId ||
          doc.currentVersionId !== input.baseVersionId
        )
          throw conflict('Save the current draft before exporting')
      } else if (!state.approved || doc.activeApprovalId !== input.approvalId)
        throw conflict('Approve the exact current version before final export')
      else await this.assertBundle(doc, { approvalId: input.approvalId }, trx)
      return new TaskService().create(
        context,
        {
          kind: 'render',
          documentId,
          mutationId: input.mutationId,
          payload: {
            exportMode: solo ? 'solo' : 'approved',
            // PDF payloads keep their original shape so replays across a deploy still match.
            ...(input.format === 'web' ? { format: 'web' } : {}),
            ...(solo ? { inputHash: reviewInputHash(doc) } : { approvalId: input.approvalId }),
            versionId: doc.currentVersionId!,
            pins: state.pins,
            brandVersion: 'humblebee-1',
          },
        },
        trx
      )
    })
    await new TaskDispatchService().dispatch()
    return task
  }
  async render(lease: TaskLease) {
    const tasks = new TaskService()
    await tasks.recordStage(lease, 'preparing')
    const doc = await new AccessService().document(lease.context, lease.task.documentId!)
    const state = await new ReadinessService().inspect(doc)
    this.assertSnapshot(doc, state, lease.task.payload, 'Approval changed before rendering')
    await this.assertBundle(doc, lease.task.payload)
    const version = await DocumentVersion.query()
      .where({
        id: doc.currentVersionId!,
        workspaceId: lease.context.workspaceId,
        documentId: doc.id,
      })
      .firstOrFail()
    const content = await this.content(lease.context, doc.id, version.content, () =>
      tasks.check(lease)
    )
    await tasks.recordStage(lease, 'validating')
    const client = this.client(content)
    const format = exportFormat(lease.task.payload.format)
    let buffer: Buffer
    if (format === 'web') {
      await tasks.recordStage(lease, 'rendering')
      buffer = Buffer.from(await this.webHtml(doc, client, { final: true }), 'utf8')
    } else {
      // A canvas is drawn as laid out; a brochure has its own renderer; the older
      // layout rules apply to neither.
      const canvas = await this.canvasHtml(lease.context, doc, version.id, { final: true })
      const brochure = canvas ?? (await this.brochureHtml(doc, client, { final: true }))
      const layout = brochure ? null : await this.layoutPlan(doc, client, { final: true })
      await tasks.recordStage(lease, 'rendering')
      buffer = brochure
        ? Buffer.from(await ExportPdfService.fromHtml(brochure))
        : await ExportPdfService.generate(client, {
            publication: publicationLayout(),
            ...(layout ? { layout } : {}),
          })
    }
    const { extension, contentType } = EXPORT_FORMATS[format]
    const key = `workspaces/${lease.context.workspaceId}/exports/${lease.task.id}.${extension}`
    try {
      await tasks.finish(
        lease,
        async (trx) => {
          const current = await Document.query({ client: trx })
            .where({ id: doc.id, workspaceId: lease.context.workspaceId })
            .forUpdate()
            .firstOrFail()
          const currentState = await new ReadinessService().inspect(current, trx)
          this.assertSnapshot(
            current,
            currentState,
            lease.task.payload,
            'Approval changed during rendering'
          )
          await this.assertBundle(current, lease.task.payload, trx)
          await drive.use().put(key, buffer, { contentType, visibility: 'private' })
          return {
            artifactKey: key,
            format,
            exportMode: lease.task.payload.exportMode,
            approvalId: current.activeApprovalId,
            versionId: current.currentVersionId,
          }
        },
        { lockWorkspace: true }
      )
    } catch (error) {
      await drive
        .use()
        .delete(key)
        .catch(() => {})
      throw error
    }
  }
  async download(context: WorkspaceAccessContext, documentId: string, taskId: string) {
    if (!uuid(taskId)) throw missingResource()
    return db.transaction(async (trx) => {
      await Workspace.query({ client: trx })
        .where('id', context.workspaceId)
        .forUpdate()
        .firstOrFail()
      await new AccessService().lock(context, trx)
      const doc = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      const task = await WorkspaceTask.query({ client: trx })
        .where({
          id: taskId,
          workspaceId: context.workspaceId,
          documentId,
          kind: 'render',
          status: 'succeeded',
        })
        .firstOrFail()
      const state = await new ReadinessService().inspect(doc, trx)
      this.assertSnapshot(
        doc,
        state,
        { ...task.payload, ...task.result },
        'This final export is no longer approved'
      )
      await this.assertBundle(doc, { ...task.payload, ...task.result }, trx)
      if (typeof task.result.artifactKey !== 'string') throw missingResource()
      return {
        stream: await drive.use().getStream(task.result.artifactKey),
        title: doc.title ?? 'Case study',
        format: exportFormat(task.result.format ?? task.payload.format),
      }
    })
  }
  async preview(
    context: WorkspaceAccessContext,
    documentId: string,
    format: 'html' | 'pdf' | 'web' = 'pdf',
    /**
     * Collections render the revision they pinned. `final` drops the draft
     * banner and applies the final-export fit rules; callers must have checked
     * the collection approval first.
     */
    { versionId, final = false }: { versionId?: string; final?: boolean } = {}
  ) {
    const access = new AccessService()
    const doc = await access.document(context, documentId)
    const pinned = versionId ?? doc.currentVersionId
    if (!pinned) throw conflict('Save a version before previewing')
    const version = await DocumentVersion.query()
      .where({ id: pinned, documentId, workspaceId: context.workspaceId })
      .firstOrFail()
    const check = () => new EvidenceService().check(context)
    const content = await this.content(context, documentId, version.content, check)
    await check()
    const client = this.client(content)
    const brochure =
      format === 'web'
        ? null
        : ((await this.canvasHtml(context, doc, version.id, {
            final,
            // A preview of the current version shows the editor's unsaved draft too, so a
            // box deleted in the canvas is gone from the preview before "Save version".
            draft: !final && !versionId,
          })) ?? (await this.brochureHtml(doc, client, { final })))
    const layout =
      brochure || format === 'web' ? null : await this.layoutPlan(doc, client, { final })
    const buffer =
      format === 'web'
        ? await this.webHtml(doc, client, { final })
        : brochure
          ? format === 'html'
            ? brochure
            : Buffer.from(await ExportPdfService.fromHtml(brochure))
          : await ExportPdfService[format === 'html' ? 'html' : 'generate'](client, {
              preview: !final,
              publication: publicationLayout(),
              ...(layout ? { layout } : {}),
            })
    await check()
    const current = await access.document(context, documentId)
    if (!versionId && current.currentVersionId !== version.id)
      throw conflict('The saved version changed during preview')
    if (final && current.currentVersionId !== version.id)
      throw conflict('The saved version changed during export')
    return buffer
  }
  /**
   * Single projection point for preview and export, both layouts. A hard
   * failure stops rendering with field paths only, never content snippets;
   * the saved version is left untouched for the author to repair.
   */
  private client(content: Parameters<PublicationProjectionService['project']>[0]) {
    try {
      const { client, diagnostics } = new PublicationProjectionService().project(content)
      const errors = diagnostics.filter((d) => d.severity === 'error')
      if (errors.length)
        throw new ClientContentError(errors.map((d) => ({ field: d.field, code: d.code })))
      return client
    } catch (error) {
      if (!(error instanceof ClientContentError)) throw error
      throw new Exception(
        `Repair publication fields before exporting: ${error.issues.map((i) => `${i.field} (${i.code})`).join(', ')}`,
        { status: 422, code: 'E_PUBLICATION_UNSAFE' }
      )
    }
  }
  /**
   * The pages, brand and designs a document renders with. A document with page
   * designs uses them; any other document reads as a cover followed by article
   * pages, so the web export works for every document.
   */
  private async pages(doc: Document, client: ClientRenderData) {
    const selection = await new LayoutSelectionService().peek(doc.workspaceId!, doc.id)
    const chosen = selection.options.brochure
    const brand = getBrandKit(selection.brandId, selection.brandVersion)
    if (!brand)
      throw new Exception('The pinned brand version is not available', {
        status: 422,
        code: 'E_LAYOUT_INVALID',
      })
    const parsed = parsePages(client)
    const designs: DesignId[] = chosen
      ? resolveDesigns(chosen.pages, parsed.length)
      : parsed.map((_, index) => (index === 0 ? 'cover' : 'article'))
    const pages: BrochurePage[] = parsed.map((sections, index) => ({
      design: designs[index],
      sections,
    }))
    return { brochure: !!chosen, brand, pages }
  }

  /**
   * The canvas layout of a version, or null when the document is not in the canvas
   * editor or the version was saved as text. Frame text goes through the same
   * evidence, image and projection pipeline as every export, in one pass, so
   * citation numbers follow reading order across the canvas. With `draft`, the
   * editor's autosaved draft of that version is drawn instead, when there is one.
   */
  private async canvasHtml(
    context: Ctx,
    doc: Document,
    versionId: string,
    { final, draft = false }: { final: boolean; draft?: boolean }
  ) {
    if (!canvasEnabled()) return null
    const service = new CanvasService()
    if ((await service.mode(context.workspaceId, doc.id)) !== 'canvas') return null
    const row = draft
      ? await service.previewProject(context, doc.id, versionId)
      : await service
          .forVersion(versionId)
          .then((r) => (r ? { project: r.project, draft: false } : null))
    if (!row) return null
    const selection = await new LayoutSelectionService().peek(doc.workspaceId!, doc.id)
    const brand = getBrandKit(selection.brandId, selection.brandVersion)
    if (!brand)
      throw new Exception('The pinned brand version is not available', {
        status: 422,
        code: 'E_LAYOUT_INVALID',
      })
    const check = () => new EvidenceService().check(context)
    const projected = this.client(
      await this.content(context, doc.id, projectionDocument(row.project), check, {
        imageFrames: imageFrameSizes(row.project),
      })
    )
    return renderCanvasHtml(row.project, brand, {
      content: splitProjected(row.project, projected.body),
      sources: projected.sources,
      preview: !final,
      unsaved: row.draft,
      focus: await this.imageFocus(context, doc.id, row.project),
    })
  }

  /** The focal point stored for each document image a canvas shows. */
  private async imageFocus(context: Ctx, documentId: string, canvas: CanvasDocument) {
    const ids = [...imageFrameSizes(canvas).keys()]
    if (!ids.length) return new Map<string, { x: number; y: number }>()
    const rows = await DocumentImage.query()
      .where({ workspaceId: context.workspaceId, documentId })
      .whereIn('id', ids)
      .whereNotNull('focusX')
      .whereNotNull('focusY')
    return new Map(rows.map((row) => [row.id, { x: row.focusX!, y: row.focusY! }]))
  }

  /**
   * The brochure for a document that has page designs, or null for any other. Pages come
   * from the page breaks in the text, each drawn in the design pinned for its position.
   */
  private async brochureHtml(
    doc: Document,
    client: ClientRenderData,
    { final }: { final: boolean }
  ) {
    const { brochure, brand, pages } = await this.pages(doc, client)
    if (!brochure) return null
    return renderBrochureHtml(pages, brand, { sources: client.sources, preview: !final })
  }

  /**
   * The same content as the PDF, as one responsive web page. Key results appear only
   * where the PDF shows them (the brochure designs have no place for them).
   */
  private async webHtml(doc: Document, client: ClientRenderData, { final }: { final: boolean }) {
    const { brochure, brand, pages } = await this.pages(doc, client)
    return renderWebHtml(pages, brand, {
      title: client.title ?? doc.title ?? undefined,
      sources: client.sources,
      results: brochure ? [] : (client.results ?? []),
      preview: !final,
    })
  }

  /**
   * Fit and content findings for the pinned layout, for the picker and review
   * panel. Null when there is nothing renderable yet or the content cannot be
   * projected safely (that case is reported by the preview itself).
   */
  async layoutReport(context: WorkspaceAccessContext, documentId: string) {
    const access = new AccessService()
    const doc = await access.document(context, documentId)
    if (!doc.currentVersionId) return null
    const version = await DocumentVersion.query()
      .where({ id: doc.currentVersionId, documentId, workspaceId: context.workspaceId })
      .firstOrFail()
    try {
      const content = await this.content(context, documentId, version.content, () =>
        new EvidenceService().check(context)
      )
      const client = this.client(content)
      const selection = await new LayoutSelectionService().peek(context.workspaceId, documentId)
      const template = getTemplate(selection.templateId, selection.templateVersion)!
      const brand = getBrandKit(selection.brandId, selection.brandVersion)!
      if (selection.options.brochure) {
        // One sheet per page design; the only findings are text longer than a design holds.
        const pages = parsePages(client)
        const designs = resolveDesigns(selection.options.brochure.pages, pages.length)
        return {
          pages: pages.length,
          pageBudget: pages.length,
          fits: true,
          density: 'normal' as const,
          steps: [],
          findings: pages.flatMap((sections, index) =>
            lengthWarnings(designs[index], sections, index + 1).map((message) => ({
              code: 'brochure_text_long',
              severity: 'warning' as const,
              message,
            }))
          ),
        }
      }
      const data = renumberFootnotes(client)
      const fit = fitPlan(planLayout(data, template, brand, selection.options), template)
      return {
        pages: fit.pages,
        pageBudget: template.pageBudget,
        fits: fit.fits,
        density: fit.plan.density,
        steps: fit.steps,
        findings: [...fit.findings, ...checkContent(data, { brand })],
      }
    } catch {
      return null
    }
  }

  /**
   * Template layout for a document: used when it has a saved selection, or for
   * every document when PUBLICATION_LAYOUT=templates. Preview always renders
   * (watermarked) so findings can be acted on; final export refuses error-severity
   * layout or content findings, and approval cannot bypass them.
   */
  private async layoutPlan(doc: Document, client: ClientRenderData, { final }: { final: boolean }) {
    const selection = await new LayoutSelectionService().peek(doc.workspaceId!, doc.id)
    if (!selection.saved && env.get('PUBLICATION_LAYOUT') !== 'templates') return null
    const template = getTemplate(selection.templateId, selection.templateVersion)
    const brand = getBrandKit(selection.brandId, selection.brandVersion)
    if (!template || !brand)
      throw new Exception('The pinned template or brand version is not available', {
        status: 422,
        code: 'E_LAYOUT_INVALID',
      })
    let data: ClientRenderData
    try {
      data = renumberFootnotes(client)
    } catch {
      throw new Exception('Repair citations before exporting: a reference has no source', {
        status: 422,
        code: 'E_LAYOUT_FIT',
      })
    }
    const fit = fitPlan(planLayout(data, template, brand, selection.options), template)
    if (final) {
      const errors = [...fit.findings, ...checkContent(data, { brand })].filter(
        (finding) => finding.severity === 'error'
      )
      if (errors.length)
        throw new Exception(
          `Resolve these issues before final export: ${[...new Set(errors.map((e) => e.code))].join(', ')}`,
          { status: 422, code: 'E_LAYOUT_FIT' }
        )
    }
    return fit.plan
  }

  /**
   * An approval covers a content/template/brand/options/assets bundle. Approvals
   * made before bundles existed carry no hash and are not given one retroactively.
   */
  private async assertBundle(
    doc: Document,
    snapshot: Record<string, unknown>,
    trx?: Parameters<BundleService['current']>[1]
  ) {
    if (snapshot.exportMode === 'solo' || typeof snapshot.approvalId !== 'string') return
    const approval = await DocumentApproval.query({ client: trx })
      .where({ id: snapshot.approvalId, documentId: doc.id, workspaceId: doc.workspaceId })
      .first()
    if (!approval?.bundleHash) return
    const current = await new BundleService().current(doc, trx)
    if (!current || current.hash !== approval.bundleHash)
      throw conflict(
        'The content, layout or brand changed after approval. Review and approve again.'
      )
  }

  private assertSnapshot(
    doc: Document,
    state: Awaited<ReturnType<ReadinessService['inspect']>>,
    snapshot: Record<string, unknown>,
    approvalMessage: string
  ) {
    if (snapshot.exportMode === 'solo') {
      if (state.reviewRequired)
        throw conflict('Review and approval are required in a shared workspace')
      if (
        !state.canExport ||
        doc.currentVersionId !== snapshot.versionId ||
        reviewInputHash(doc) !== snapshot.inputHash ||
        !Array.isArray(snapshot.pins) ||
        fingerprint(state.pins) !== fingerprint(snapshot.pins)
      )
        throw conflict('The draft changed. Request a new PDF.')
    } else if (
      !state.approved ||
      doc.activeApprovalId !== snapshot.approvalId ||
      doc.currentVersionId !== snapshot.versionId
    )
      throw conflict(approvalMessage)
  }
  private async content(
    context: WorkspaceAccessContext,
    documentId: string,
    value: unknown,
    guard: () => Promise<void>,
    {
      imageFrames = new Map<string, { w: number; h: number }>(),
    }: {
      /**
       * Canvas export only: the largest frame each document image fills, in tenths of a
       * millimetre. Those images are embedded as the print variant resized to the frame
       * at 300 dpi, not as the original bytes.
       */
      imageFrames?: ReadonlyMap<string, { w: number; h: number }>
    } = {}
  ) {
    const service = new EvidenceService()
    const resized = new Map<string, { mime: string; bytes: Buffer }>()
    const content = await service.hydrate(
      context,
      documentId,
      new ContentService().normalize(value, { repair: true })
    )
    const embed = async (node: (typeof content.content)[number]): Promise<void> => {
      if (
        node.type === 'image' &&
        (typeof node.attrs?.sourceChunkId === 'string' ||
          typeof node.attrs?.documentImageId === 'string')
      ) {
        await guard()
        const frame =
          typeof node.attrs?.documentImageId === 'string'
            ? imageFrames.get(node.attrs.documentImageId)
            : undefined
        if (frame) {
          const printed = await new DocumentImageService().exportAsset(
            context,
            documentId,
            node.attrs!.documentImageId as string,
            frame,
            resized
          )
          if (!/^image\/(png|jpeg|gif|webp)$/.test(printed.mime))
            throw conflict('Unsupported export image')
          node.attrs!.src = `data:${printed.mime};base64,${printed.bytes.toString('base64')}`
        } else {
          const asset =
            typeof node.attrs?.documentImageId === 'string'
              ? await new DocumentImageService().asset(
                  context,
                  documentId,
                  node.attrs.documentImageId
                )
              : await service.asset(context, documentId, node.attrs!.sourceChunkId as string)
          if (!/^image\/(png|jpeg|gif|webp)$/.test(asset.mime))
            throw conflict('Unsupported export image')
          const chunks: Buffer[] = []
          let size = 0
          for await (const chunk of asset.stream) {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            size += bytes.length
            if (size > 20000000) throw conflict('Export image is too large')
            chunks.push(bytes)
          }
          node.attrs!.src = `data:${asset.mime};base64,${Buffer.concat(chunks).toString('base64')}`
        }
      }
      for (const child of node.content ?? []) await embed(child)
    }
    for (const node of content.content) await embed(node)
    return content
  }
}
