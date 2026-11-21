import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import env from '#start/env'
import Document from '#models/document'
import DocumentCanvas, { type CanvasSource } from '#models/document_canvas'
import DocumentCanvasDraft from '#models/document_canvas_draft'
import DocumentImage from '#models/document_image'
import DocumentLayout from '#models/document_layout'
import DocumentVersion from '#models/document_version'
import VersionService, { type AttachedVersionData } from '#services/documents/version_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import { defaultLayout } from '#services/layout/layout_validation'
import AccessService, {
  conflict,
  missingResource,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import { resolveDesigns, type DesignId } from '../../../shared/brochure/designs.ts'
import { composeCanvas, splitSheets } from '../../../shared/canvas/compose.ts'
import { deriveDocument } from '../../../shared/canvas/derive.ts'
import {
  CANVAS_SCHEMA_VERSION,
  parseCanvas,
  type CanvasDocument,
  type TipTapBlock,
} from '../../../shared/canvas/model.ts'
import { hashOf } from '../../../shared/layout/hash.ts'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export const canvasEnabled = () => env.get('CANVAS_EDITOR') === 'pilot'

/** Text for a case study opened in the canvas before it has any: a cover and one page. */
export function starterContent(title: string): { type: 'doc'; content: TipTapBlock[] } {
  const text = (value: string) => [{ type: 'text', text: value }]
  return {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: text(title || 'Untitled case study') },
      { type: 'horizontalRule' },
      { type: 'heading', attrs: { level: 2 }, content: text('The challenge') },
      { type: 'paragraph', content: text('Double-click to write.') },
    ] as TipTapBlock[],
  }
}

export type CanvasState = {
  mode: 'flow' | 'canvas'
  project: CanvasDocument | null
  /** Where `project` came from: the autosaved draft or the current version. */
  source: 'draft' | 'version' | 'composed' | null
  /** Draft compare-and-set counter; 0 when there is no draft yet. */
  revision: number
  baseVersionId: string | null
}

const invalid = (problems: { path: string; message: string }[]) =>
  new Exception(
    `The canvas is not valid: ${problems
      .slice(0, 5)
      .map((p) => (p.path ? `${p.path}: ${p.message}` : p.message))
      .join('; ')}`,
    { status: 422, code: 'E_CANVAS_INVALID' }
  )

/**
 * The canvas editor's server side. A canvas belongs to a saved version: saving
 * writes the derived text as the version's content and the canvas beside it in
 * one transaction, so review, approval, export and history treat a layout change
 * like any other change. Autosave goes to a per-document draft first.
 */
export default class CanvasService {
  assertEnabled() {
    if (!canvasEnabled()) throw missingResource()
  }

  /** The canvas for a version, or null when it was saved as text only. */
  forVersion(versionId: string, trx?: TransactionClientContract) {
    return DocumentCanvas.query({ client: trx }).where('versionId', versionId).first()
  }

  async mode(workspaceId: string, documentId: string, trx?: TransactionClientContract) {
    const row = await DocumentLayout.query({ client: trx })
      .where({ workspaceId, documentId })
      .first()
    return row?.editorMode ?? 'flow'
  }

  async state(context: WorkspaceAccessContext, documentId: string): Promise<CanvasState> {
    this.assertEnabled()
    const doc = await new AccessService().document(context, documentId)
    const mode = await this.mode(context.workspaceId, documentId)
    const draft = await DocumentCanvasDraft.query()
      .where({ documentId, workspaceId: context.workspaceId })
      .first()
    // A draft started from an older version is stale: the version wins.
    if (draft && draft.baseVersionId === doc.currentVersionId)
      return {
        mode,
        project: draft.project,
        source: 'draft',
        revision: draft.revision,
        baseVersionId: doc.currentVersionId,
      }
    const canvas = doc.currentVersionId ? await this.forVersion(doc.currentVersionId) : null
    // A version saved outside the canvas (e.g. a new draft generated) has no layout yet:
    // lay its text out again rather than losing the canvas. Saved on the first edit.
    if (!canvas && mode === 'canvas' && doc.currentVersionId) {
      const current = await DocumentVersion.findOrFail(doc.currentVersionId)
      return {
        mode,
        project: await this.compose(context, documentId, current.content),
        source: 'composed',
        revision: draft?.revision ?? 0,
        baseVersionId: doc.currentVersionId,
      }
    }
    return {
      mode,
      project: canvas?.project ?? null,
      source: canvas ? 'version' : null,
      revision: draft?.revision ?? 0,
      baseVersionId: doc.currentVersionId,
    }
  }

  /** Ids of the images uploaded to this document; a canvas may show no other. */
  private async imageIds(context: WorkspaceAccessContext, documentId: string) {
    const rows = await DocumentImage.query()
      .where({ workspaceId: context.workspaceId, documentId })
      .select('id')
    return new Set(rows.map((row) => row.id))
  }

  async validate(context: WorkspaceAccessContext, documentId: string, project: unknown) {
    const parsed = parseCanvas(project, { imageIds: await this.imageIds(context, documentId) })
    if (!parsed.ok) throw invalid(parsed.problems)
    return parsed.canvas
  }

  /**
   * Opens a document in the canvas editor. The first time, its pages are laid out
   * by their designs and saved as a new version; later calls change nothing.
   */
  async enable(context: WorkspaceAccessContext, documentId: string, mutationId: string) {
    this.assertEnabled()
    const doc = await new AccessService().document(context, documentId)
    const current = doc.currentVersionId
      ? await DocumentVersion.findOrFail(doc.currentVersionId)
      : null
    const existing = current ? await this.forVersion(current.id) : null
    if (!existing) {
      // A new case study has no text yet: start from its title on a cover and a blank page.
      const content = current?.content ?? starterContent(doc.title)
      const canvas = await this.compose(context, documentId, content)
      await this.saveCanvas(context, documentId, {
        canvas: await this.validate(context, documentId, canvas),
        baseVersionId: current?.id ?? null,
        mutationId,
        source: 'composed',
      })
    }
    await this.setMode(context, documentId, 'canvas')
    return this.state(context, documentId)
  }

  /** Lays the text out on sheets, one design per page (the brochure's, or cover then article). */
  private async compose(
    context: WorkspaceAccessContext,
    documentId: string,
    content: { content?: TipTapBlock[] } | null
  ) {
    const selection = await new LayoutSelectionService().peek(context.workspaceId, documentId)
    const pages = splitSheets(content)
    const designs: DesignId[] = selection.options.brochure
      ? resolveDesigns(selection.options.brochure.pages, pages.length)
      : pages.map((_, i) => (i === 0 ? 'cover' : 'article'))
    return composeCanvas(content, designs)
  }

  /** Back to the text editor. The text of the canvas stays; history keeps every canvas. */
  async disable(context: WorkspaceAccessContext, documentId: string) {
    this.assertEnabled()
    await new AccessService().document(context, documentId)
    await this.setMode(context, documentId, 'flow')
    await DocumentCanvasDraft.query()
      .where({ documentId, workspaceId: context.workspaceId })
      .delete()
    return this.state(context, documentId)
  }

  private async setMode(
    context: WorkspaceAccessContext,
    documentId: string,
    mode: 'flow' | 'canvas'
  ) {
    await db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const row = await DocumentLayout.query({ client: trx })
        .where({ documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .first()
      if (row) {
        if (row.editorMode !== mode)
          await row.useTransaction(trx).merge({ editorMode: mode }).save()
        return
      }
      // A document that never saved a layout gets the default one, now pinned.
      const pinned = defaultLayout()
      await DocumentLayout.create(
        {
          documentId,
          workspaceId: context.workspaceId,
          templateId: pinned.templateId,
          templateVersion: pinned.templateVersion,
          brandId: pinned.brandId,
          brandVersion: pinned.brandVersion,
          options: pinned.options,
          revision: 1,
          editorMode: mode,
          updatedBy: context.actorId,
        },
        { client: trx }
      )
    })
  }

  /** Autosave. Two tabs cannot overwrite each other: the revision must match. */
  async draft(
    context: WorkspaceAccessContext,
    documentId: string,
    input: { project?: unknown; revision: number; baseVersionId: string | null }
  ) {
    this.assertEnabled()
    await new AccessService().document(context, documentId)
    const canvas = await this.validate(context, documentId, input.project)
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const doc = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if ((await this.mode(context.workspaceId, documentId, trx)) !== 'canvas')
        throw conflict('Open the document in the canvas editor first')
      if (doc.currentVersionId !== input.baseVersionId)
        throw conflict('A newer version exists. Reload the canvas before editing.')
      const draft = await DocumentCanvasDraft.query({ client: trx })
        .where({ documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .first()
      const current = draft?.revision ?? 0
      if (input.revision !== current)
        throw new Exception('The canvas was changed in another tab', {
          status: 409,
          code: 'E_CANVAS_REVISION',
        })
      const values = {
        project: canvas,
        schemaVersion: CANVAS_SCHEMA_VERSION,
        baseVersionId: input.baseVersionId,
        revision: current + 1,
        updatedBy: context.actorId,
      }
      if (draft) await draft.useTransaction(trx).merge(values).save()
      else
        await DocumentCanvasDraft.create(
          { documentId, workspaceId: context.workspaceId, ...values },
          { client: trx }
        )
      return { revision: current + 1 }
    })
  }

  /** Saves the canvas as a new version (or returns the current one if nothing changed). */
  async save(
    context: WorkspaceAccessContext,
    documentId: string,
    input: { project?: unknown; baseVersionId: string | null; mutationId: string }
  ) {
    this.assertEnabled()
    // Access first: another workspace learns nothing, not even the editor mode.
    await new AccessService().document(context, documentId)
    if ((await this.mode(context.workspaceId, documentId)) !== 'canvas')
      throw conflict('Open the document in the canvas editor first')
    const canvas = await this.validate(context, documentId, input.project)
    return this.saveCanvas(context, documentId, { ...input, canvas, source: 'edited' })
  }

  private async saveCanvas(
    context: WorkspaceAccessContext,
    documentId: string,
    input: {
      canvas: CanvasDocument
      baseVersionId: string | null
      mutationId: string
      source: CanvasSource
      templateId?: string | null
    }
  ) {
    const hash = hashOf(input.canvas)
    const latest = input.baseVersionId ? await DocumentVersion.find(input.baseVersionId) : null
    // Publication metadata (hero, results) refers to blocks by id; the frames keep those ids.
    const attrs = (latest?.content as { attrs?: Record<string, unknown> } | null)?.attrs
    const attached: AttachedVersionData = {
      hash,
      changedSince: async (version, trx) => {
        const saved = await this.forVersion(version.id, trx)
        return saved?.projectHash !== hash
      },
      persist: async (version, trx) => {
        await DocumentCanvas.create(
          {
            workspaceId: context.workspaceId,
            documentId,
            versionId: version.id,
            schemaVersion: CANVAS_SCHEMA_VERSION,
            project: input.canvas,
            projectHash: hash,
            sheetCount: input.canvas.sheets.length,
            source: input.source,
            templateId: input.templateId ?? null,
            createdBy: context.actorId,
          },
          { client: trx }
        )
      },
    }
    const version = await new VersionService().save(context, documentId, {
      content: deriveDocument(input.canvas, attrs) as { content: TipTapBlock[] },
      baseVersionId: input.baseVersionId,
      mutationId: input.mutationId,
      attached,
    })
    await DocumentCanvasDraft.query()
      .where({ documentId, workspaceId: context.workspaceId })
      .delete()
    return { version, canvas: await this.forVersion(version.id) }
  }
}
