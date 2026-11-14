import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Document from '#models/document'
import DocumentVersion from '#models/document_version'
import WorkspaceTask from '#models/workspace_task'
import WorkflowEvent from '#models/workflow_event'
import AccessService, { type WorkspaceAccessContext } from '#services/workspaces/access_service'
import OutlineTemplateService from '#services/documents/outline_template_service'
import ContentService from '#services/documents/content_service'
import { fingerprint } from '#services/workspaces/task_service'
import type { CanonicalContent } from '../../../shared/templates/content.ts'
import { segments } from '../../../shared/templates/editor.ts'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'

type OldDefinition = { key?: string; sections?: { key: string; heading: string }[] }
export default class LegacyTemplateService {
  project(content: CanonicalContent, definition: OldDefinition = {}): TipTapDocument {
    const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
    const nodes: TipTapDocument['content'] = [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: content.title }] },
      paragraph(content.description),
    ]
    for (const section of content.sections) {
      nodes.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [
          {
            type: 'text',
            text:
              definition.sections?.find((item) => item.key === section.key)?.heading ??
              section.key.replaceAll('_', ' '),
          },
        ],
      })
      for (const block of section.blocks) {
        if (block.type === 'paragraph')
          nodes.push({
            type: 'paragraph',
            content: segments(block).map((segment) => ({ type: 'text', ...segment })),
          })
        if (block.type === 'list' || block.type === 'capability_group') {
          if (block.type === 'capability_group')
            nodes.push(paragraph(`${block.heading} — ${block.availability}`))
          nodes.push({
            type: 'bulletList',
            content: block.items.map((text) => ({ type: 'listItem', content: [paragraph(text)] })),
          })
        }
        if (block.type === 'metric_table')
          nodes.push(
            ...block.rows.map((row) =>
              paragraph(
                `${row.label}: ${row.value} ${row.unit}. Scope: ${row.scope}. Methodology: ${row.methodology}.`
              )
            )
          )
        if (block.type === 'comparison_table')
          nodes.push(
            ...block.rows.map((row) =>
              paragraph(row.map((cell, index) => `${block.columns[index]}: ${cell}`).join(' · '))
            )
          )
        if (block.type === 'reference_link')
          nodes.push({
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: block.label,
                marks: [{ type: 'link', attrs: { href: block.url } }],
              },
            ],
          })
        if (block.type === 'image') {
          nodes.push({
            type: 'image',
            attrs: { sourceChunkId: block.sourceChunkId, alt: block.alt, title: block.caption },
          })
          if (block.caption) nodes.push(paragraph(block.caption))
        }
        if (block.evidenceIds.length)
          nodes.push({
            type: 'paragraph',
            content: block.evidenceIds.map((id) => ({
              type: 'sourceCitation',
              attrs: { sourceChunkId: id },
            })),
          })
      }
    }
    return new ContentService().normalize({ type: 'doc', content: nodes })
  }
  async history(versions: DocumentVersion[]) {
    const ids = [
      ...new Set(versions.filter((v) => v.canonicalContent).map((v) => v.templateVersionId!)),
    ]
    const definitions = ids.length
      ? await db.from('document_template_versions').whereIn('id', ids).select('id', 'definition')
      : []
    for (const version of versions)
      if (version.canonicalContent)
        version.content = this.project(
          version.canonicalContent,
          definitions.find((item) => item.id === version.templateVersionId)?.definition
        )
  }
  async convert(context: WorkspaceAccessContext, documentId: string) {
    return db.transaction(async (trx) => {
      await new AccessService().lock(context, trx)
      const doc = await Document.query({ client: trx })
        .where({ id: documentId, workspaceId: context.workspaceId })
        .forUpdate()
        .firstOrFail()
      if (doc.contentMode !== 'template') return false
      const old = doc.currentVersionId
        ? await DocumentVersion.findOrFail(doc.currentVersionId, { client: trx })
        : null
      const definition = doc.selectedTemplateVersionId
        ? await trx
            .from('document_template_versions')
            .where('id', doc.selectedTemplateVersionId)
            .first()
        : null
      const key =
        definition?.definition.key === 'CS-TECHNICAL'
          ? 'technical'
          : definition?.definition.key === 'CS-VISION'
            ? 'vision'
            : 'portfolio'
      const outline = await new OutlineTemplateService().resolve(key, { legacy: true })
      const latest = await DocumentVersion.query({ client: trx })
        .where('documentId', doc.id)
        .orderBy('version', 'desc')
        .first()
      const content = old?.canonicalContent
        ? this.project(old.canonicalContent, definition?.definition)
        : (old?.content ?? new OutlineTemplateService().skeleton(outline.definition, doc.title))
      const version = await DocumentVersion.create(
        {
          workspaceId: context.workspaceId,
          documentId: doc.id,
          userId: context.actorId,
          version: (latest?.version ?? 0) + 1,
          content,
          mutationId: randomUUID(),
          requestHash: fingerprint(content),
          parentVersionId: old?.id ?? null,
          generationSnapshot: { convertedFromVersionId: old?.id ?? null },
        },
        { client: trx }
      )
      await WorkspaceTask.query({ client: trx })
        .where({ workspaceId: context.workspaceId, documentId: doc.id })
        .whereIn('status', ['queued', 'running'])
        .update({
          status: 'cancelled',
          safeError: 'The document now uses an editable outline. Start a new request.',
          leaseToken: null,
          leaseExpiresAt: null,
        })
      await trx
        .from('document_approvals')
        .where({ workspace_id: context.workspaceId, document_id: doc.id })
        .whereNotNull('snapshot_hash')
        .whereNull('revoked_at')
        .update({
          revoked_at: new Date(),
          revoked_by_id: context.actorId,
          revocation_reason: 'Converted to an editable document outline',
        })
      doc.merge({
        contentMode: 'legacy',
        selectedTemplateVersionId: null,
        templateSetup: { outline },
        currentVersionId: version.id,
        activeApprovalId: null,
        activeReviewId: null,
        generationTaskId: null,
        generationStatus: 'ready',
        generationError: null,
        generationLeaseAt: null,
        status: 'edited',
        metadataRevision: doc.metadataRevision + 1,
        updatedAt: DateTime.utc(),
      })
      await doc.save()
      await WorkflowEvent.create(
        {
          workspaceId: context.workspaceId,
          documentId: doc.id,
          actorId: context.actorId,
          operation: 'invalidate',
          mutationId: randomUUID(),
          requestHash: fingerprint({ from: old?.id, to: version.id }),
          result: {
            reason: 'Converted to editable outline',
            previousVersionId: old?.id ?? null,
            versionId: version.id,
          },
        },
        { client: trx }
      )
      return true
    })
  }
}
