import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import {
  missingResource,
  uuid,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import AccessService from '#services/workspaces/access_service'
import type { SourcePin } from '#services/workspaces/task_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
export type EvidenceRow = {
  id: string
  chunk_index: number
  content: string
  file_id: string
  file_name: string
  file_key: string | null
  media_type: string | null
  page_number: number | null
  kind: 'text' | 'image'
}
export default class EvidenceService {
  async check(context: WorkspaceAccessContext) {
    await db.transaction((trx) => new AccessService().lock(context, trx))
  }
  eligible(context: WorkspaceAccessContext, documentId: string, pins?: SourcePin[]) {
    // Every retrieval branch starts from the same selected-source and tenant relation.
    return {
      sql: `SELECT DISTINCT ON (c.id) c.id,c.chunk_index,c.content,c.kind,f.id AS file_id,f.filename AS file_name,b.source_locator->>'fileKey' AS file_key,b.source_locator->>'mediaType' AS media_type,NULLIF(b.source_locator->>'pageNumber','')::integer AS page_number,c.content_tsv,c.run_id
      FROM document_files df
      JOIN documents d ON d.id=df.document_id AND d.workspace_id=df.workspace_id
      JOIN files f ON f.id=df.files_id AND f.workspace_id=df.workspace_id
      JOIN file_revisions fr ON fr.file_id=f.id AND fr.workspace_id=f.workspace_id
      JOIN processing_runs pr ON pr.file_revision_id=fr.id AND pr.workspace_id=fr.workspace_id AND pr.status='ready'
      JOIN chunks c ON c.run_id=pr.id AND c.file_revision_id=fr.id AND c.workspace_id=pr.workspace_id AND NOT c.tenancy_quarantined
      JOIN chunk_blocks cb ON cb.chunk_id=c.id AND cb.workspace_id=c.workspace_id AND cb.run_id=c.run_id
      JOIN document_blocks b ON b.id=cb.document_block_id AND b.workspace_id=cb.workspace_id AND b.processing_run_id=cb.run_id
      WHERE df.workspace_id=? AND df.document_id=?
      AND (?::jsonb IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(?::jsonb) p WHERE p->>'fileId'=f.id::text AND p->>'revisionId'=fr.id::text AND p->>'runId'=pr.id::text AND p->>'pipelineVersion'=pr.pipeline_version AND p->>'embeddingModel'=pr.embedding_model))
      ORDER BY c.id,b.order_index`,
      bindings: [
        context.workspaceId,
        documentId,
        pins ? JSON.stringify(pins) : null,
        pins ? JSON.stringify(pins) : null,
      ],
    }
  }
  async rows(
    context: WorkspaceAccessContext,
    documentId: string,
    ids?: string[],
    pins?: SourcePin[]
  ) {
    await this.check(context)
    await new AccessService().document(context, documentId)
    const relation = this.eligible(context, documentId, pins)
    const result = await db.rawQuery<{ rows: EvidenceRow[] }>(
      `WITH eligible AS (${relation.sql}) SELECT * FROM eligible ${ids ? 'WHERE id=ANY(?::uuid[])' : ''} ORDER BY chunk_index LIMIT 200`,
      [...relation.bindings, ...(ids ? [ids] : [])]
    )
    return result.rows
  }
  source(context: WorkspaceAccessContext, documentId: string, row: EvidenceRow): SourceChunk {
    return {
      id: row.id,
      chunkIndex: Number(row.chunk_index),
      content: row.content,
      fileName: row.file_name,
      fileUrl: `/workspaces/${context.workspaceId}/documents/${documentId}/evidence/${row.id}/asset`,
      mediaType: row.media_type,
      pageNumber: row.page_number === null ? null : Number(row.page_number),
    }
  }
  async historical(context: WorkspaceAccessContext, documentId: string, ids: string[]) {
    await this.check(context)
    await new AccessService().document(context, documentId)
    const result = await db.rawQuery<{ rows: EvidenceRow[] }>(
      `SELECT DISTINCT ON(c.id) c.id,c.chunk_index,c.content,c.kind,f.id AS file_id,f.filename AS file_name,b.source_locator->>'fileKey' AS file_key,b.source_locator->>'mediaType' AS media_type,NULLIF(b.source_locator->>'pageNumber','')::integer AS page_number
      FROM chunks c JOIN files f ON f.id=c.file_id AND f.workspace_id=c.workspace_id
      JOIN chunk_blocks cb ON cb.chunk_id=c.id AND cb.workspace_id=c.workspace_id AND cb.run_id=c.run_id
      JOIN document_blocks b ON b.id=cb.document_block_id AND b.workspace_id=cb.workspace_id AND b.processing_run_id=cb.run_id
      WHERE c.workspace_id=? AND c.id=ANY(?::uuid[]) AND NOT c.tenancy_quarantined
      AND EXISTS(SELECT 1 FROM document_versions dv WHERE dv.workspace_id=c.workspace_id AND dv.document_id=? AND jsonb_path_exists(dv.content,'$.**.sourceChunkId ? (@ == $chunk)',jsonb_build_object('chunk',c.id::text))) ORDER BY c.id,b.order_index`,
      [context.workspaceId, ids, documentId]
    )
    return result.rows
  }
  async chunk(context: WorkspaceAccessContext, documentId: string, chunkId: string) {
    if (!uuid(chunkId)) throw missingResource()
    const current = await this.rows(context, documentId, [chunkId])
    const historic = current.length ? [] : await this.historical(context, documentId, [chunkId])
    const row = current[0] ?? historic[0]
    if (!row) throw missingResource()
    return row
  }
  async asset(context: WorkspaceAccessContext, documentId: string, chunkId: string) {
    const row = await this.chunk(context, documentId, chunkId)
    if (!row.file_key) throw missingResource()
    await this.check(context)
    return {
      stream: await drive.use().getStream(row.file_key),
      mime: row.media_type ?? 'application/octet-stream',
    }
  }
  async hydrate(
    context: WorkspaceAccessContext,
    documentId: string,
    value: import('#services/documents/chunk_metadata_service').TipTapDocument
  ) {
    const ids: string[] = []
    const visit = (node: (typeof value.content)[number]) => {
      if (typeof node.attrs?.sourceChunkId === 'string' && uuid(node.attrs.sourceChunkId))
        ids.push(node.attrs.sourceChunkId)
      node.content?.forEach(visit)
    }
    value.content.forEach(visit)
    const rows = ids.length
      ? [
          ...(await this.rows(context, documentId, [...new Set(ids)])),
          ...(await this.historical(context, documentId, [...new Set(ids)])),
        ]
      : []
    const { attachChunkMetadata } = await import('#services/documents/chunk_metadata_service')
    return attachChunkMetadata(
      value,
      rows.map((row) => this.source(context, documentId, row))
    )
  }
}
