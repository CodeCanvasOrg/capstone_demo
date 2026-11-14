import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import Document from '#models/document'
import DocumentVersion from '#models/document_version'
import PortfolioCollection from '#models/portfolio_collection'
import Project from '#models/project'
import Workspace from '#models/workspace'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import AccessService, {
  conflict,
  missingResource,
  uuid,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import {
  buildManifest,
  collectionBudget,
  composeContents,
  manifestHash,
  type CollectionEntry,
  type Wrapper,
} from '../../../shared/layout/collection.ts'
import { getTemplate } from '../../../shared/layout/templates.ts'
import { DEFAULT_BRAND_ID } from '#services/layout/layout_validation'
import { getBrandKit } from '../../../shared/layout/brand.ts'

const invalid = (message: string) =>
  new Exception(message, { status: 422, code: 'E_COLLECTION_INVALID' })

type Node = { attrs?: Record<string, unknown>; content?: Node[] }
const evidenceKeys = (content: Node) => {
  const keys = new Set<string>()
  const walk = (node: Node) => {
    if (typeof node.attrs?.sourceChunkId === 'string') keys.add(node.attrs.sourceChunkId)
    node.content?.forEach(walk)
  }
  walk(content)
  return [...keys].sort()
}

/**
 * Collections pin entry revisions in a hashed manifest (PRT-01/02/04). Approval
 * binds to that hash and to each pinned revision still being current, so an
 * edited entry, changed wrapper copy, reorder or deleted entry makes it stale.
 * Entry owners' own approvals are untouched: a collection reviewer cannot
 * bypass them (D-COLLECTION is still a proposed policy, so this does not yet
 * *require* entry approval either).
 */
export default class CollectionService {
  private find(context: WorkspaceAccessContext, id: string) {
    if (!uuid(id)) throw missingResource()
    return PortfolioCollection.query().where({ id, workspaceId: context.workspaceId }).firstOrFail()
  }

  list(context: WorkspaceAccessContext) {
    return PortfolioCollection.query()
      .where('workspaceId', context.workspaceId)
      .orderBy('updatedAt', 'desc')
  }

  async get(context: WorkspaceAccessContext, id: string) {
    return this.find(context, id)
  }

  /** Pins one saved entry as it is now. The id must be a document in this workspace. */
  private async pin(context: WorkspaceAccessContext, documentId: string): Promise<CollectionEntry> {
    const document: Document = await new AccessService().document(context, documentId)
    if (!document.currentVersionId)
      throw invalid(`"${document.title}" has no saved version to include.`)
    const version = await DocumentVersion.query()
      .where({ id: document.currentVersionId, documentId, workspaceId: context.workspaceId })
      .firstOrFail()
    const selection = await new LayoutSelectionService().peek(context.workspaceId, documentId)
    const template = getTemplate(selection.templateId, selection.templateVersion)!
    const project = document.projectId
      ? await Project.query()
          .where({ id: document.projectId, workspaceId: context.workspaceId })
          .first()
      : null
    return {
      entryId: document.id,
      revisionId: version.id,
      title: document.title,
      category: project?.name ?? 'Case studies',
      templateId: template.id,
      templateVersion: template.version,
      // The page budget is an upper bound until a measured count replaces it.
      pages: template.pageBudget,
      evidenceKeys: evidenceKeys(version.content as Node),
    }
  }

  private async entries(
    context: WorkspaceAccessContext,
    ids: string[],
    keep: CollectionEntry[] = []
  ) {
    if (!ids.length) throw invalid('Select at least one entry.')
    if (new Set(ids).size !== ids.length) throw invalid('An entry can appear only once.')
    const pinned = new Map(keep.map((entry) => [entry.entryId, entry]))
    const out: CollectionEntry[] = []
    // Any inaccessible or unknown id rejects the whole request.
    for (const id of ids) {
      const entry = pinned.get(id) ?? (await this.pin(context, id))
      out.push(entry)
    }
    return out
  }

  async create(
    context: WorkspaceAccessContext,
    input: { name: string; entryIds: string[]; wrapper: Wrapper }
  ) {
    const name = input.name.trim()
    if (!name || name.length > 120) throw invalid('Collection names must be 1 to 120 characters.')
    const entries = await this.entries(context, input.entryIds)
    const brand = getBrandKit(DEFAULT_BRAND_ID)!
    const manifest = buildManifest({
      name,
      entries,
      wrapper: input.wrapper,
      brand: { id: brand.id, version: brand.version },
    })
    return PortfolioCollection.create({
      workspaceId: context.workspaceId,
      name,
      manifest,
      manifestHash: manifestHash(manifest),
      status: 'draft',
      createdBy: context.actorId,
    })
  }

  async update(
    context: WorkspaceAccessContext,
    id: string,
    input: { name?: string; entryIds?: string[]; wrapper?: Wrapper; baseHash: string }
  ) {
    // Pin lookups happen before the lock; only the compare-and-set is inside it.
    const before = await this.find(context, id)
    const entries = input.entryIds
      ? await this.entries(context, input.entryIds, before.manifest.entries)
      : before.manifest.entries
    return db.transaction(async (trx) => {
      await Workspace.query({ client: trx })
        .where('id', context.workspaceId)
        .forUpdate()
        .firstOrFail()
      await new AccessService().lock(context, trx)
      const row = await PortfolioCollection.query({ client: trx })
        .where({ id, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (row.manifestHash !== input.baseHash)
        throw conflict('This collection changed. Reload it and try again.')
      const name = (input.name ?? row.manifest.name ?? row.name).trim()
      if (!name || name.length > 120) throw invalid('Collection names must be 1 to 120 characters.')
      const manifest = buildManifest({
        name,
        entries,
        wrapper: input.wrapper ?? row.manifest.wrapper,
        brand: row.manifest.brand,
      })
      const hash = manifestHash(manifest)
      if (hash === row.manifestHash) return row
      row.merge({
        name,
        manifest,
        manifestHash: hash,
        // Any manifest change withdraws a previous approval.
        status: 'draft',
        approvedHash: null,
        approvedBy: null,
        approvedAt: null,
      })
      return row.useTransaction(trx).save()
    })
  }

  async budget(context: WorkspaceAccessContext, id: string, input: { target?: number }) {
    const { manifest } = await this.find(context, id)
    return collectionBudget(manifest, input)
  }

  async contents(context: WorkspaceAccessContext, id: string) {
    const { manifest } = await this.find(context, id)
    return composeContents(manifest.entries, { about: !!manifest.wrapper.about })
  }

  /** Whether the stored approval still describes what would be published. */
  async state(context: WorkspaceAccessContext, id: string) {
    const row = await this.find(context, id)
    const staleEntries: string[] = []
    for (const entry of row.manifest.entries) {
      const document = await Document.query()
        .where({ id: entry.entryId, workspaceId: context.workspaceId })
        .first()
      if (!document || document.currentVersionId !== entry.revisionId)
        staleEntries.push(entry.entryId)
    }
    const approval =
      row.status !== 'approved' || row.approvedHash !== row.manifestHash
        ? 'none'
        : staleEntries.length
          ? 'stale'
          : 'current'
    return { approval: approval as 'none' | 'current' | 'stale', staleEntries }
  }

  async approve(context: WorkspaceAccessContext, id: string, baseHash: string) {
    return db.transaction(async (trx) => {
      await Workspace.query({ client: trx })
        .where('id', context.workspaceId)
        .forUpdate()
        .firstOrFail()
      await new AccessService().lock(context, trx)
      const row = await PortfolioCollection.query({ client: trx })
        .where({ id, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (row.manifestHash !== baseHash)
        throw conflict('This collection changed. Review the current version before approving.')
      for (const entry of row.manifest.entries) {
        const document = await Document.query({ client: trx })
          .where({ id: entry.entryId, workspaceId: context.workspaceId })
          .first()
        if (!document || document.currentVersionId !== entry.revisionId)
          throw conflict('An entry changed after it was added. Update the collection first.')
      }
      row.merge({
        status: 'approved',
        approvedHash: row.manifestHash,
        approvedBy: context.actorId,
        approvedAt: DateTime.utc(),
      })
      return row.useTransaction(trx).save()
    })
  }

  /** Publication and download both call this; a stale or inaccessible dependency refuses. */
  async assertPublishable(context: WorkspaceAccessContext, id: string) {
    // Access is rechecked now: a revoked membership cannot publish an old approval.
    await db.transaction((trx) => new AccessService().lock(context, trx))
    const state = await this.state(context, id)
    if (state.approval !== 'current')
      throw conflict('The collection approval is missing, stale or an entry changed.')
  }
}
