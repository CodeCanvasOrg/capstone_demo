import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Backstop for the project source rule enforced in services: a case study may
 * only select files that are linked to no project (workspace files) or linked
 * to the case study's own project. Checked at commit so multi-step changes in
 * one transaction are judged on their final state.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE FUNCTION project_source_scope_violated(p_document uuid, p_file uuid)
        RETURNS boolean AS $$
          SELECT EXISTS (
            SELECT 1
            FROM document_files df
            JOIN documents d ON d.id = df.document_id AND d.workspace_id = df.workspace_id
            WHERE (p_document IS NULL OR df.document_id = p_document)
              AND (p_file IS NULL OR df.files_id = p_file)
              AND EXISTS (
                SELECT 1 FROM project_files pf
                WHERE pf.workspace_id = df.workspace_id AND pf.file_id = df.files_id
              )
              AND NOT EXISTS (
                SELECT 1 FROM project_files pf
                WHERE pf.workspace_id = df.workspace_id
                  AND pf.file_id = df.files_id
                  AND pf.project_id = d.project_id
              )
          )
        $$ LANGUAGE sql STABLE`)
      await db.rawQuery(`
        CREATE FUNCTION enforce_project_source_scope() RETURNS trigger AS $$
        DECLARE
          violated boolean := false;
        BEGIN
          IF TG_TABLE_NAME = 'document_files' THEN
            violated := project_source_scope_violated(NEW.document_id, NEW.files_id);
          ELSIF TG_TABLE_NAME = 'documents' THEN
            violated := project_source_scope_violated(NEW.id, NULL);
          ELSE
            IF TG_OP <> 'INSERT' THEN
              violated := project_source_scope_violated(NULL, OLD.file_id);
            END IF;
            IF NOT violated AND TG_OP <> 'DELETE' THEN
              violated := project_source_scope_violated(NULL, NEW.file_id);
            END IF;
          END IF;
          IF violated THEN
            RAISE EXCEPTION 'A selected source belongs to another project'
              USING ERRCODE = '23514', CONSTRAINT = 'project_source_scope';
          END IF;
          RETURN NULL;
        END
        $$ LANGUAGE plpgsql`)
      await db.rawQuery(`
        CREATE CONSTRAINT TRIGGER document_files_project_scope
        AFTER INSERT OR UPDATE ON document_files DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION enforce_project_source_scope()`)
      await db.rawQuery(`
        CREATE CONSTRAINT TRIGGER project_files_project_scope
        AFTER INSERT OR UPDATE OR DELETE ON project_files DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION enforce_project_source_scope()`)
      await db.rawQuery(`
        CREATE CONSTRAINT TRIGGER documents_project_scope
        AFTER UPDATE OF project_id ON documents DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION enforce_project_source_scope()`)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP TRIGGER IF EXISTS documents_project_scope ON documents')
      await db.rawQuery('DROP TRIGGER IF EXISTS project_files_project_scope ON project_files')
      await db.rawQuery('DROP TRIGGER IF EXISTS document_files_project_scope ON document_files')
      await db.rawQuery('DROP FUNCTION IF EXISTS enforce_project_source_scope()')
      await db.rawQuery('DROP FUNCTION IF EXISTS project_source_scope_violated(uuid, uuid)')
    })
  }
}
