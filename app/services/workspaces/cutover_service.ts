import db from '@adonisjs/lucid/services/db'
import { z } from 'zod'
import MigrationService, { validateMapping, type MigrationMapping } from './migration_service.ts'
const baselineSchema = z
  .object({
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    counts: z.record(z.string(), z.number().int().min(0)),
    identities: z.record(z.string(), z.string()),
  })
  .passthrough()
const originalTables = [
  'users',
  'documents',
  'files',
  'shares',
  'attachments',
  'chunks',
  'revisions',
  'runs',
  'blocks',
  'mappings',
  'versions',
  'embeddings',
]
/** Explicit maintenance-window operation, run only after reviewed backfill. */
export default class CutoverService {
  async finalize(input: unknown, mappingInput: MigrationMapping, apply = false) {
    const baseline = baselineSchema.parse(input)
    const mapping = validateMapping(mappingInput)
    if (mapping.auditFingerprint !== baseline.fingerprint)
      throw new Error('Mapping does not match the saved pre-backfill audit')
    const trx = await db.transaction()
    try {
      await trx.rawQuery(
        'LOCK TABLE users,workspaces,workspace_memberships,documents,files,document_versions,document_files,file_revisions,processing_runs,document_blocks,chunks,chunk_blocks,chunk_embeddings,document_shares IN SHARE ROW EXCLUSIVE MODE'
      )
      const service = new MigrationService()
      const current = await service.audit(trx)
      for (const table of originalTables)
        if (
          current.counts[table] !== baseline.counts[table] ||
          current.identities[table] !== baseline.identities[table]
        )
          throw new Error(`Original records changed since the audit: ${table}`)
      const verification = await service.verify()
      if (!verification.valid)
        throw new Error(`Unresolved tenancy boundaries: ${JSON.stringify(verification.missing)}`)
      for (const conflict of current.conflicts) {
        if (
          conflict.kind === 'legacy_share' &&
          !mapping.shareResolutions?.[String(conflict.ids[0])]?.reason
        )
          throw new Error(`Unreviewed legacy share: ${conflict.key}`)
        if (conflict.kind === 'email_collision')
          throw new Error('Resolve duplicate account emails before cutover')
        if (
          ['invalid_evidence_lineage', 'mismatched_chunk_block'].includes(conflict.kind) &&
          !mapping.quarantineChunks?.includes(String(conflict.ids[0]))
        )
          throw new Error(`Unreviewed quarantine: ${conflict.key}`)
      }
      for (const table of [
        'documents',
        'files',
        'document_versions',
        'document_files',
        'file_revisions',
        'processing_runs',
        'document_blocks',
      ])
        await trx.rawQuery(`ALTER TABLE ${table} ALTER COLUMN workspace_id SET NOT NULL`)
      await trx.rawQuery(
        `DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='chunks_operational_tenancy') THEN ALTER TABLE chunks ADD CONSTRAINT chunks_operational_tenancy CHECK(tenancy_quarantined OR (workspace_id IS NOT NULL AND file_revision_id IS NOT NULL AND run_id IS NOT NULL)); END IF; END $$`
      )
      await trx.rawQuery(
        `CREATE OR REPLACE FUNCTION enforce_evidence_child_tenancy() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.workspace_id IS NULL AND NOT EXISTS(SELECT 1 FROM chunks WHERE id=NEW.chunk_id AND tenancy_quarantined) THEN RAISE EXCEPTION 'Operational evidence child requires workspace lineage' USING ERRCODE='23514'; END IF; IF TG_TABLE_NAME='chunk_blocks' THEN IF NEW.workspace_id IS NOT NULL AND NEW.run_id IS NULL THEN RAISE EXCEPTION 'Operational chunk mapping requires run lineage' USING ERRCODE='23514'; END IF; END IF; RETURN NEW; END $$`
      )
      for (const table of ['chunk_blocks', 'chunk_embeddings']) {
        await trx.rawQuery(`DROP TRIGGER IF EXISTS enforce_evidence_child_tenancy ON ${table}`)
        await trx.rawQuery(
          `CREATE TRIGGER enforce_evidence_child_tenancy BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION enforce_evidence_child_tenancy()`
        )
      }
      await trx.rawQuery(
        'CREATE UNIQUE INDEX IF NOT EXISTS users_normalized_email_unique ON users(lower(trim(email)))'
      )
      if (apply) await trx.commit()
      else await trx.rollback()
      return {
        applied: apply,
        verified: verification,
        counts: current.counts,
        identities: current.identities,
        quarantined: mapping.quarantineChunks?.length ?? 0,
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}
