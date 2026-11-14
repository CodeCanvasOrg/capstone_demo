import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Document from '#models/document'
import DocumentLayout from '#models/document_layout'
import LayoutPreset from '#models/layout_preset'
import Workspace from '#models/workspace'
import WorkflowService from '#services/documents/workflow_service'
import AccessService, {
  conflict,
  missingResource,
  uuid,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import { canonicalJson } from '../../../shared/layout/hash.ts'
import { BRAND_KITS, validateBrandKit } from '../../../shared/layout/brand.ts'
import { listTemplates } from '../../../shared/layout/templates.ts'
import {
  DOC_TYPE,
  defaultLayout,
  pinLayout,
  type PinnedLayout,
} from '#services/layout/layout_validation'

export type LayoutSelection = PinnedLayout & {
  documentId: string
  /** False while the document only has the effective default and no stored row. */
  saved: boolean
  presetId: string | null
  /** 0 until the first real save; used for compare-and-set. */
  revision: number
}

/** Only what determines the output; revision, saved and preset bookkeeping are excluded. */
const pinnedOf = ({
  templateId,
  templateVersion,
  brandId,
  brandVersion,
  options,
}: PinnedLayout) => ({
  templateId,
  templateVersion,
  brandId,
  brandVersion,
  options,
})
const same = (a: PinnedLayout, b: PinnedLayout) =>
  canonicalJson(pinnedOf(a)) === canonicalJson(pinnedOf(b))

const fromRow = (row: DocumentLayout): LayoutSelection => ({
  documentId: row.documentId,
  saved: true,
  presetId: row.presetId,
  revision: row.revision,
  templateId: row.templateId,
  templateVersion: row.templateVersion,
  brandId: row.brandId,
  brandVersion: row.brandVersion,
  options: row.options ?? { imageMode: 'auto' },
})

export default class LayoutSelectionService {
  /**
   * Effective selection without an access check. Callers (export, approval)
   * have already authorized the document; HTTP paths use `resolve`.
   */
  async peek(workspaceId: string, documentId: string, trx?: TransactionClientContract) {
    const row = await DocumentLayout.query({ client: trx })
      .where({ documentId, workspaceId })
      .first()
    return row
      ? fromRow(row)
      : ({
          documentId,
          saved: false,
          presetId: null,
          revision: 0,
          ...defaultLayout(),
        } as LayoutSelection)
  }

  async resolve(context: WorkspaceAccessContext, documentId: string) {
    await new AccessService().document(context, documentId)
    return this.peek(context.workspaceId, documentId)
  }

  /** Enabled templates, published brand kits and this workspace's presets. */
  async catalog(context: WorkspaceAccessContext, docType: string = DOC_TYPE) {
    const presets = await LayoutPreset.query()
      .where('workspaceId', context.workspaceId)
      .orderBy('name')
    return {
      templates: listTemplates({ docType: docType as typeof DOC_TYPE }).map((template) => ({
        id: template.id,
        version: template.version,
        title: template.title,
        description: template.description,
        pageBudget: template.pageBudget,
        options: template.options,
      })),
      brands: BRAND_KITS.filter(
        (kit) =>
          kit.status === 'published' &&
          !validateBrandKit(kit).some((finding) => finding.severity === 'error')
      ).map((kit) => ({
        id: kit.id,
        version: kit.version,
        name: kit.name,
        palette: kit.palette,
        findings: validateBrandKit(kit).map(({ code, message }) => ({ code, message })),
      })),
      presets: presets.map((preset) => ({
        id: preset.id,
        name: preset.name,
        templateId: preset.templateId,
        templateVersion: preset.templateVersion,
        brandId: preset.brandId,
        brandVersion: preset.brandVersion,
        options: preset.options,
      })),
    }
  }

  async save(
    context: WorkspaceAccessContext,
    documentId: string,
    input: {
      templateId: string
      templateVersion?: number
      brandId?: string
      brandVersion?: number
      options?: unknown
      baseRevision: number
      presetId?: string | null
    }
  ): Promise<LayoutSelection> {
    // Validation first: a forged request never reaches a lock or a write.
    const next = pinLayout(input)
    return db.transaction(async (trx) => {
      await Workspace.query({ client: trx })
        .where('id', context.workspaceId)
        .forUpdate()
        .firstOrFail()
      await new AccessService().lock(context, trx)
      const document = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      const current = await this.peek(context.workspaceId, documentId, trx)
      const presetId = input.presetId ?? null
      const sameOutput = same(next, current)
      // Saving what is already effective changes nothing, so approval survives.
      if (sameOutput && presetId === current.presetId) return current
      if (input.baseRevision !== current.revision)
        throw conflict('The layout selection changed. Reload it and try again.')

      const values = {
        templateId: next.templateId,
        templateVersion: next.templateVersion,
        brandId: next.brandId,
        brandVersion: next.brandVersion,
        options: next.options,
        presetId,
        updatedBy: context.actorId,
      }
      if (current.saved)
        await DocumentLayout.query({ client: trx })
          .where({ documentId, workspaceId: context.workspaceId })
          .update({ ...values, revision: current.revision + 1 })
      else
        await DocumentLayout.create(
          { documentId, workspaceId: context.workspaceId, ...values, revision: 1 },
          { client: trx }
        )
      // Template, brand and option changes alter the output the owner approved.
      // Only recording which preset was used leaves the output as it was.
      if (!sameOutput) {
        await new WorkflowService().invalidate(
          document,
          context.actorId,
          'The layout selection changed',
          trx
        )
        await document.useTransaction(trx).save()
      }
      return this.peek(context.workspaceId, documentId, trx)
    })
  }

  async applyPreset(
    context: WorkspaceAccessContext,
    documentId: string,
    presetId: string,
    baseRevision: number
  ) {
    if (!uuid(presetId)) throw missingResource()
    const preset = await LayoutPreset.query()
      .where({ id: presetId, workspaceId: context.workspaceId })
      .firstOrFail()
    return this.save(context, documentId, {
      templateId: preset.templateId,
      templateVersion: preset.templateVersion,
      brandId: preset.brandId,
      brandVersion: preset.brandVersion,
      options: preset.options,
      baseRevision,
      presetId: preset.id,
    })
  }
}
