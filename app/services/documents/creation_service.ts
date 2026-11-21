import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import DocumentService, { type DocumentInput } from '#services/documents/document_service'
import GenerationService from '#services/documents/generation_service'
import env from '#start/env'
import OutlineTemplateService from '#services/documents/outline_template_service'
import DocumentLayout from '#models/document_layout'
import { DEFAULT_TEMPLATE_ID } from '../../../shared/layout/templates.ts'
import { pinLayout } from '#services/layout/layout_validation'
import { BRANDED_TEMPLATE_ID, BROCHURE_TEMPLATE_ID } from '../../../shared/templates/outlines.ts'
import { resolveInstructions } from '../../../shared/templates/instructions.ts'
import { type WorkspaceAccessContext } from '#services/workspaces/access_service'
export const PENDING_TITLE = 'Untitled case study'
/** New documents use the branded entry unless the deployment opts back to the old outline. */
const legacyFormat = () => env.get('GENERATION_FORMAT') === 'legacy'
const defaultTemplateId = () => (legacyFormat() ? 'portfolio' : BRANDED_TEMPLATE_ID)
export default class CreationService {
  async document(
    context: WorkspaceAccessContext,
    allInput: Omit<DocumentInput, 'title'> & {
      title?: string
      templateId?: string | null
      instructions?: string | null
      /** The brochure's page designs. With no selection the model chooses every page. */
      brochure?: unknown
    },
    fileIds: string[],
    client?: TransactionClientContract
  ) {
    const { instructions, brochure, ...input } = allInput
    const create = async (trx: TransactionClientContract) => {
      const outline =
        input.templateId === null
          ? null
          : await new OutlineTemplateService().resolve(input.templateId ?? defaultTemplateId(), {
              legacy: legacyFormat(),
            })
      const generateTitle = !input.title
      const doc = await new DocumentService().create(
        context,
        { ...input, title: input.title || PENDING_TITLE },
        fileIds,
        trx
      )
      doc.merge({
        selectedTemplateVersionId: null,
        templateSetup: {
          ...(outline ? { outline } : {}),
          ...(generateTitle ? { generateTitle } : {}),
          instructions: resolveInstructions(instructions),
        },
      })
      await doc.save()
      if (input.templateId === BROCHURE_TEMPLATE_ID) {
        // Pinned in this transaction, so the generation requested below writes these pages.
        const pinned = pinLayout({
          templateId: DEFAULT_TEMPLATE_ID,
          options: { brochure: brochure ?? { source: 'ai', pages: ['auto'] } },
        })
        await DocumentLayout.create(
          {
            documentId: doc.id,
            workspaceId: context.workspaceId,
            templateId: pinned.templateId,
            templateVersion: pinned.templateVersion,
            brandId: pinned.brandId,
            brandVersion: pinned.brandVersion,
            options: pinned.options,
            presetId: null,
            updatedBy: context.actorId,
            revision: 1,
          },
          { client: trx }
        )
      }
      await new GenerationService().request(context, doc.id, randomUUID(), null, trx)
      return doc
    }
    return client ? create(client) : db.transaction(create)
  }
}
