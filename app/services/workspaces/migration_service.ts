import { createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import User from '#models/user'
import Workspace from '#models/workspace'
import WorkspaceMembership from '#models/workspace_membership'

export type MigrationMapping = {
  auditFingerprint: string
  resourceWorkspaces?: { documents?: Record<string, string>; files?: Record<string, string> }
  shareResolutions?: Record<string, { action: 'retire' | 'membership'; reason: string }>
  quarantineChunks?: string[]
}

export default class MigrationService {
  private async snapshot(trx: TransactionClientContract) {
    const users = await trx.from('users').select('id', 'email').orderBy('id')
    const documents = await trx
      .from('documents')
      .select('id', 'user_id', 'workspace_id', 'status')
      .orderBy('id')
    const files = await trx.from('files').select('id', 'user_id', 'workspace_id').orderBy('id')
    const shares = await trx
      .from('document_shares')
      .select('id', 'document_id', 'user_id', 'role')
      .orderBy('id')
    const attachments = await trx
      .from('document_files')
      .select('id', 'document_id', 'files_id', 'workspace_id')
      .orderBy('id')
    const chunks = await trx
      .from('chunks')
      .select('id', 'file_id', 'file_revision_id', 'run_id', 'workspace_id')
      .orderBy('id')
    const revisions = await trx
      .from('file_revisions')
      .select('id', 'file_id', 'workspace_id')
      .orderBy('id')
    const runs = await trx
      .from('processing_runs')
      .select('id', 'file_revision_id', 'workspace_id')
      .orderBy('id')
    const blocks = await trx
      .from('document_blocks')
      .select('id', 'processing_run_id', 'workspace_id')
      .orderBy('id')
    const mappings = await trx
      .from('chunk_blocks')
      .select('id', 'chunk_id', 'document_block_id', 'workspace_id')
      .orderBy('id')
    return {
      users,
      documents,
      files,
      shares,
      attachments,
      chunks,
      revisions,
      runs,
      blocks,
      mappings,
    }
  }

  private report(snapshot: Awaited<ReturnType<MigrationService['snapshot']>>) {
    const conflicts: { key: string; kind: string; ids: (string | number)[] }[] = []
    for (const share of snapshot.shares) {
      const document = snapshot.documents.find((d) => d.id === share.document_id)
      if (document?.user_id !== share.user_id)
        conflicts.push({
          key: `share:${share.id}`,
          kind: 'legacy_share',
          ids: [share.id, share.document_id, share.user_id],
        })
    }
    for (const attachment of snapshot.attachments) {
      const doc = snapshot.documents.find((d) => d.id === attachment.document_id)!
      const file = snapshot.files.find((f) => f.id === attachment.files_id)!
      if (
        doc.user_id !== file.user_id ||
        (doc.workspace_id && file.workspace_id && doc.workspace_id !== file.workspace_id)
      )
        conflicts.push({
          key: `attachment:${attachment.id}`,
          kind: 'cross_owner_attachment',
          ids: [attachment.id, doc.id, file.id],
        })
    }
    for (const chunk of snapshot.chunks) {
      const revision = snapshot.revisions.find((r) => r.id === chunk.file_revision_id)
      const run = snapshot.runs.find((r) => r.id === chunk.run_id)
      if (
        !revision ||
        !run ||
        revision.file_id !== chunk.file_id ||
        run.file_revision_id !== revision.id
      )
        conflicts.push({
          key: `chunk:${chunk.id}`,
          kind: 'invalid_evidence_lineage',
          ids: [chunk.id],
        })
    }
    for (const mapping of snapshot.mappings) {
      const chunk = snapshot.chunks.find((c) => c.id === mapping.chunk_id)
      const block = snapshot.blocks.find((b) => b.id === mapping.document_block_id)
      if (!chunk?.run_id || chunk.run_id !== block?.processing_run_id)
        conflicts.push({
          key: `chunk:${mapping.chunk_id}`,
          kind: 'mismatched_chunk_block',
          ids: [mapping.chunk_id, mapping.id],
        })
    }
    const emails = new Map<string, number>()
    for (const user of snapshot.users) {
      const email = user.email.trim().toLowerCase()
      if (emails.has(email))
        conflicts.push({
          key: `email:${user.id}`,
          kind: 'email_collision',
          ids: [emails.get(email)!, user.id],
        })
      emails.set(email, user.id)
    }
    return {
      fingerprint: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
      counts: Object.fromEntries(Object.entries(snapshot).map(([key, rows]) => [key, rows.length])),
      conflicts,
    }
  }

  async audit() {
    return db.transaction(async (trx) => {
      await trx.rawQuery('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
      return this.report(await this.snapshot(trx))
    })
  }

  async backfill(mapping: MigrationMapping, apply: boolean) {
    const trx = await db.transaction()
    try {
      await trx.rawQuery(
        'LOCK TABLE users, documents, files, document_shares, document_files, file_revisions, processing_runs, document_blocks, chunks, chunk_blocks, chunk_embeddings IN SHARE ROW EXCLUSIVE MODE'
      )
      const snapshot = await this.snapshot(trx)
      const report = this.report(snapshot)
      if (mapping.auditFingerprint !== report.fingerprint)
        throw new Error('Audit changed; regenerate the report and review the mapping')
      const unresolved = report.conflicts.filter((c) => {
        if (c.kind === 'legacy_share')
          return !mapping.shareResolutions?.[String(c.ids[0])]?.reason.trim()
        if (c.kind === 'cross_owner_attachment') return false // checked against actual mapped workspaces below
        if (c.kind === 'invalid_evidence_lineage' || c.kind === 'mismatched_chunk_block')
          return !mapping.quarantineChunks?.includes(String(c.ids[0]))
        return true
      })
      if (unresolved.length)
        throw new Error(
          `Unresolved migration conflicts: ${unresolved.map((c) => c.key).join(', ')}`
        )
      const initial = new Map<number, string>()
      for (const row of snapshot.users) {
        const user = await User.findOrFail(row.id, { client: trx })
        let workspace = await Workspace.query({ client: trx })
          .where('initialForUserId', user.id)
          .first()
        if (!workspace) {
          workspace = await Workspace.create(
            {
              name: `${user.fullName?.trim() || 'My'} workspace`,
              ownerUserId: user.id,
              initialForUserId: user.id,
            },
            { client: trx }
          )
          await WorkspaceMembership.create(
            { workspaceId: workspace.id, userId: user.id, role: 'owner', authorizationEpoch: 0 },
            { client: trx }
          )
        }
        initial.set(user.id, workspace.id)
      }
      for (const [table, rows] of [
        ['documents', snapshot.documents],
        ['files', snapshot.files],
      ] as const) {
        const assignments = mapping.resourceWorkspaces?.[table]
        for (const row of rows) {
          const target = assignments?.[row.id] ?? row.workspace_id ?? initial.get(row.user_id)!
          const ownerMembership = await trx
            .from('workspace_memberships')
            .where({ workspace_id: target, user_id: row.user_id })
            .whereNull('revoked_at')
            .first()
          if (!ownerMembership)
            throw new Error(`Resource owner lacks active membership: ${table}:${row.id}`)
          await trx.from(table).where('id', row.id).update({ workspace_id: target })
        }
      }
      for (const share of snapshot.shares) {
        const decision = mapping.shareResolutions?.[share.id]
        if (decision?.action === 'membership') {
          const doc = await trx.from('documents').where('id', share.document_id).first()
          const member = await trx
            .from('workspace_memberships')
            .where({ workspace_id: doc.workspace_id, user_id: share.user_id })
            .whereNull('revoked_at')
            .first()
          if (!member) throw new Error(`Reviewed membership is not active for share:${share.id}`)
        } else if (decision && decision.action !== 'retire')
          throw new Error('Invalid share resolution')
      }
      const mismatches = await trx.rawQuery(
        'SELECT df.id FROM document_files df JOIN documents d ON d.id=df.document_id JOIN files f ON f.id=df.files_id WHERE d.workspace_id <> f.workspace_id'
      )
      if (mismatches.rows.length)
        throw new Error(
          'Attachments require explicit compatible resource workspace mappings; no sources were detached'
        )
      const updates = [
        'UPDATE document_versions v SET workspace_id=d.workspace_id FROM documents d WHERE v.document_id=d.id',
        'UPDATE document_files a SET workspace_id=d.workspace_id FROM documents d WHERE a.document_id=d.id',
        'UPDATE file_revisions r SET workspace_id=f.workspace_id FROM files f WHERE r.file_id=f.id',
        'UPDATE processing_runs p SET workspace_id=r.workspace_id FROM file_revisions r WHERE p.file_revision_id=r.id',
        'UPDATE document_blocks b SET workspace_id=p.workspace_id FROM processing_runs p WHERE b.processing_run_id=p.id',
        'UPDATE chunks c SET workspace_id=f.workspace_id FROM files f WHERE c.file_id=f.id AND NOT c.tenancy_quarantined',
        'UPDATE chunk_blocks b SET workspace_id=c.workspace_id, run_id=c.run_id FROM chunks c WHERE b.chunk_id=c.id',
        'UPDATE chunk_embeddings e SET workspace_id=c.workspace_id FROM chunks c WHERE e.chunk_id=c.id',
        "UPDATE documents SET legacy_status=status, legacy_approval_unverified=(status='approved'), status=CASE WHEN status='pending' THEN 'draft' WHEN status='editing' THEN 'edited' WHEN status='approved' THEN 'edited' ELSE COALESCE(status,'draft') END WHERE legacy_status IS NULL",
        'UPDATE documents d SET current_version_id=(SELECT v.id FROM document_versions v WHERE v.document_id=d.id ORDER BY v.version DESC LIMIT 1) WHERE current_version_id IS NULL',
      ]
      // Quarantine never invents run/revision lineage; retain the records and exclude them from retrieval.
      if (mapping.quarantineChunks?.length) {
        await trx
          .from('chunks')
          .whereIn('id', mapping.quarantineChunks)
          .update({ tenancy_quarantined: true, workspace_id: null })
      }
      for (const sql of updates) await trx.rawQuery(sql)
      if (apply) await trx.commit()
      else await trx.rollback()
      return { ...report, applied: apply }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  async verify() {
    const missing: Record<string, number> = {}
    for (const table of [
      'documents',
      'files',
      'document_versions',
      'document_files',
      'file_revisions',
      'processing_runs',
      'document_blocks',
      'chunks',
      'chunk_blocks',
      'chunk_embeddings',
    ]) {
      const query = db.from(table).whereNull('workspace_id')
      if (table === 'chunks') query.where('tenancy_quarantined', false)
      if (table === 'chunk_blocks' || table === 'chunk_embeddings')
        query.whereNotIn(
          'chunk_id',
          db.from('chunks').select('id').where('tenancy_quarantined', true)
        )
      const result = await query.count('* as total').first()
      missing[table] = Number(result?.total ?? 0)
    }
    return { valid: Object.values(missing).every((count) => count === 0), missing }
  }
}
