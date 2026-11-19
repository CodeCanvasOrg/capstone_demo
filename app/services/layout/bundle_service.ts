import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Document from '#models/document'
import DocumentVersion from '#models/document_version'
import PublicationContentService from '#services/documents/publication_content_service'
import type { PublicationDocument } from '../../../shared/publication/content.ts'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import { RENDERER_VERSION } from '#services/exports/layout_renderer'
import { BROCHURE_RENDERER_VERSION } from '#services/exports/brochure_renderer'
import { bundleHash, type ReviewBundle } from '../../../shared/layout/bundle.ts'
import { getBrandKit } from '../../../shared/layout/brand.ts'
import { hashOf } from '../../../shared/layout/hash.ts'
import { getTemplate } from '../../../shared/layout/templates.ts'

type Node = { attrs?: Record<string, unknown>; content?: Node[] }

/** Registered asset identities a document's images resolve to; no URLs, no bytes. */
export function assetIds(content: Node): string[] {
  const found = new Set<string>()
  const walk = (node: Node) => {
    for (const key of ['documentImageId', 'sourceChunkId'])
      if (typeof node.attrs?.[key] === 'string') found.add(`${key}:${node.attrs[key]}`)
    node.content?.forEach(walk)
  }
  walk(content)
  return [...found].sort()
}

/**
 * The exact inputs an approval covers, computed from stored state. Approval
 * records this hash; export and download recompute it and refuse on mismatch.
 */
export default class BundleService {
  async current(document: Document, trx?: TransactionClientContract) {
    if (!document.currentVersionId) return null
    const version = await DocumentVersion.query({ client: trx })
      .where({
        id: document.currentVersionId,
        documentId: document.id,
        workspaceId: document.workspaceId,
      })
      .firstOrFail()
    const selection = await new LayoutSelectionService().peek(
      document.workspaceId!,
      document.id,
      trx
    )
    const bundle: ReviewBundle = {
      contentHash: new PublicationContentService().contentHash(
        version.content as PublicationDocument
      ),
      versionId: version.id,
      template: { id: selection.templateId, version: selection.templateVersion },
      brand: { id: selection.brandId, version: selection.brandVersion },
      options: selection.options,
      assetIds: assetIds(version.content as Node),
      // A brochure is drawn by its own renderer, so a change to it must withdraw approvals too.
      rendererVersion: selection.options.brochure ? BROCHURE_RENDERER_VERSION : RENDERER_VERSION,
      definitions: {
        template: hashOf(getTemplate(selection.templateId, selection.templateVersion) ?? null),
        brand: hashOf(getBrandKit(selection.brandId, selection.brandVersion) ?? null),
      },
    }
    return { bundle, hash: bundleHash(bundle) }
  }
}
