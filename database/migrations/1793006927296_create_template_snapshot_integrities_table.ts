import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
ALTER TABLE document_versions ADD CONSTRAINT legacy_envelope CHECK(content_schema_version IS NOT NULL OR (canonical_content IS NULL AND snapshot_hash IS NULL AND template_version_id IS NULL AND source_manifest IS NULL));
CREATE FUNCTION canonical_manifest_scope() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE ref jsonb; BEGIN
 IF NEW.content_schema_version IS NULL THEN RETURN NEW; END IF;
 IF jsonb_typeof(NEW.source_manifest)<>'array' OR NEW.generation_snapshot->'setup'->>'templateVersionId' IS DISTINCT FROM NEW.template_version_id::text OR NOT EXISTS(SELECT 1 FROM documents d WHERE d.id=NEW.document_id AND d.workspace_id=NEW.workspace_id AND d.content_mode='template') THEN RAISE EXCEPTION 'Incoherent canonical envelope'; END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(NEW.source_manifest) LOOP
 IF NOT EXISTS(SELECT 1 FROM chunks c JOIN file_revisions fr ON fr.id=c.file_revision_id AND fr.workspace_id=c.workspace_id JOIN processing_runs pr ON pr.id=c.run_id AND pr.workspace_id=c.workspace_id AND pr.file_revision_id=fr.id JOIN chunk_blocks cb ON cb.chunk_id=c.id AND cb.workspace_id=c.workspace_id AND cb.run_id=c.run_id JOIN document_blocks b ON b.id=cb.document_block_id AND b.workspace_id=cb.workspace_id AND b.processing_run_id=cb.run_id WHERE c.workspace_id=NEW.workspace_id AND c.id::text=ref->>'id' AND c.file_id::text=ref->>'fileId' AND c.file_revision_id::text=ref->>'revisionId' AND c.run_id::text=ref->>'runId' AND b.id::text=ref->>'blockId' AND fr.source_hash=ref->>'sourceHash' AND c.content=ref->>'content' AND b.source_locator=ref->'locator' AND NOT c.tenancy_quarantined) THEN RAISE EXCEPTION 'Invalid canonical source ancestry'; END IF;
 END LOOP; RETURN NEW; END $$;
CREATE TRIGGER canonical_manifest_scope BEFORE INSERT ON document_versions FOR EACH ROW EXECUTE FUNCTION canonical_manifest_scope();
CREATE FUNCTION template_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.key<>OLD.key OR NEW.document_type<>OLD.document_type THEN RAISE EXCEPTION 'Template scope and identity are immutable'; END IF;RETURN NEW;END $$;
CREATE TRIGGER template_identity_immutable BEFORE UPDATE ON document_templates FOR EACH ROW EXECUTE FUNCTION template_identity_immutable();
CREATE FUNCTION candidate_payload_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' OR NEW.payload<>OLD.payload OR NEW.workspace_id<>OLD.workspace_id OR NEW.document_id<>OLD.document_id OR NEW.base_version_id<>OLD.base_version_id OR NEW.base_hash<>OLD.base_hash OR NEW.kind<>OLD.kind OR NEW.generation_task_id IS DISTINCT FROM OLD.generation_task_id OR NEW.actor_id<>OLD.actor_id OR (OLD.state<>'pending' AND NEW.state<>OLD.state) THEN RAISE EXCEPTION 'Candidate payload and terminal decision are immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER candidate_payload_immutable BEFORE UPDATE OR DELETE ON document_generation_candidates FOR EACH ROW EXECUTE FUNCTION candidate_payload_immutable();
CREATE FUNCTION template_record_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Template evidence, validation and export records are append-only';END $$;
CREATE TRIGGER claim_review_append_only BEFORE UPDATE OR DELETE ON document_claim_reviews FOR EACH ROW EXECUTE FUNCTION template_record_append_only();
CREATE TRIGGER validation_append_only BEFORE UPDATE OR DELETE ON document_validation_reports FOR EACH ROW EXECUTE FUNCTION template_record_append_only();
CREATE TRIGGER evidence_append_only BEFORE UPDATE OR DELETE ON document_evidence_references FOR EACH ROW EXECUTE FUNCTION template_record_append_only();
CREATE TRIGGER media_append_only BEFORE UPDATE OR DELETE ON document_media_bindings FOR EACH ROW EXECUTE FUNCTION template_record_append_only();
CREATE TRIGGER export_append_only BEFORE UPDATE OR DELETE ON document_exports FOR EACH ROW EXECUTE FUNCTION template_record_append_only();
CREATE FUNCTION evidence_projection_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.source_kind='file' AND NOT EXISTS(SELECT 1 FROM document_versions v CROSS JOIN LATERAL jsonb_array_elements(v.source_manifest) ref WHERE v.id=NEW.version_id AND v.workspace_id=NEW.workspace_id AND v.document_id=NEW.document_id AND ref->>'id'=NEW.chunk_id::text AND ref=NEW.source_reference) THEN RAISE EXCEPTION 'Evidence is outside version manifest'; END IF; RETURN NEW;END $$;
CREATE TRIGGER evidence_projection_scope BEFORE INSERT ON document_evidence_references FOR EACH ROW EXECUTE FUNCTION evidence_projection_scope();
CREATE FUNCTION template_task_intent_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.payload->>'templateMode'='true' AND (NEW.payload<>OLD.payload OR NEW.document_id IS DISTINCT FROM OLD.document_id OR NEW.workspace_id<>OLD.workspace_id OR NEW.actor_id<>OLD.actor_id OR NEW.request_hash<>OLD.request_hash) THEN RAISE EXCEPTION 'Template task intent is immutable'; END IF;RETURN NEW;END $$;
CREATE TRIGGER template_task_intent_immutable BEFORE UPDATE ON workspace_tasks FOR EACH ROW EXECUTE FUNCTION template_task_intent_immutable();
CREATE FUNCTION template_approval_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.snapshot_hash IS NOT NULL AND (to_jsonb(NEW)-ARRAY['revoked_at','revoked_by_id','revocation_reason','updated_at'] IS DISTINCT FROM to_jsonb(OLD)-ARRAY['revoked_at','revoked_by_id','revocation_reason','updated_at'] OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)) THEN RAISE EXCEPTION 'Template approval snapshot is immutable'; END IF;RETURN NEW;END $$;
CREATE TRIGGER template_approval_immutable BEFORE UPDATE ON document_approvals FOR EACH ROW EXECUTE FUNCTION template_approval_immutable();
`)
    })
  }
  async down() {
    this.defer(async (db) => {
      await db.rawQuery(
        `DROP TRIGGER template_approval_immutable ON document_approvals;DROP FUNCTION template_approval_immutable();DROP TRIGGER template_task_intent_immutable ON workspace_tasks;DROP FUNCTION template_task_intent_immutable();DROP TRIGGER evidence_projection_scope ON document_evidence_references;DROP FUNCTION evidence_projection_scope();DROP TRIGGER export_append_only ON document_exports;DROP TRIGGER media_append_only ON document_media_bindings;DROP TRIGGER evidence_append_only ON document_evidence_references;DROP TRIGGER validation_append_only ON document_validation_reports;DROP TRIGGER claim_review_append_only ON document_claim_reviews;DROP FUNCTION template_record_append_only();DROP TRIGGER candidate_payload_immutable ON document_generation_candidates;DROP FUNCTION candidate_payload_immutable();DROP TRIGGER template_identity_immutable ON document_templates;DROP FUNCTION template_identity_immutable();DROP TRIGGER canonical_manifest_scope ON document_versions;DROP FUNCTION canonical_manifest_scope();ALTER TABLE document_versions DROP CONSTRAINT legacy_envelope;`
      )
    })
  }
}
