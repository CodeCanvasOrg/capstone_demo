import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  private tables = [
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
  ]
  async up() {
    for (const name of this.tables) {
      this.schema.alterTable(name, (table) => {
        table.uuid('workspace_id').nullable().references('workspaces.id')
        table.index(['workspace_id'])
        if (name !== 'document_files') table.unique(['workspace_id', 'id'])
      })
    }
    this.schema.alterTable('chunk_blocks', (table) => {
      table.uuid('run_id').nullable()
    })
    this.schema.alterTable('users', (table) => {
      table.uuid('last_workspace_id').nullable().references('workspaces.id')
    })
    this.defer(async (db) => {
      const sql = [
        'ALTER TABLE file_revisions ADD UNIQUE (workspace_id, id, file_id)',
        'ALTER TABLE processing_runs ADD UNIQUE (workspace_id, id, file_revision_id)',
        'ALTER TABLE chunks ADD UNIQUE (workspace_id, run_id, id)',
        'ALTER TABLE document_blocks ADD UNIQUE (workspace_id, processing_run_id, id)',
        'ALTER TABLE document_files ADD UNIQUE (workspace_id, document_id, files_id)',
        'ALTER TABLE document_versions ADD FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id)',
        'ALTER TABLE document_files ADD FOREIGN KEY (workspace_id, document_id) REFERENCES documents(workspace_id, id)',
        'ALTER TABLE document_files ADD FOREIGN KEY (workspace_id, files_id) REFERENCES files(workspace_id, id)',
        'ALTER TABLE file_revisions ADD FOREIGN KEY (workspace_id, file_id) REFERENCES files(workspace_id, id)',
        'ALTER TABLE processing_runs ADD FOREIGN KEY (workspace_id, file_revision_id) REFERENCES file_revisions(workspace_id, id)',
        'ALTER TABLE document_blocks ADD FOREIGN KEY (workspace_id, processing_run_id) REFERENCES processing_runs(workspace_id, id)',
        'ALTER TABLE chunks ADD FOREIGN KEY (workspace_id, file_revision_id, file_id) REFERENCES file_revisions(workspace_id, id, file_id)',
        'ALTER TABLE chunks ADD FOREIGN KEY (workspace_id, run_id, file_revision_id) REFERENCES processing_runs(workspace_id, id, file_revision_id)',
        'ALTER TABLE chunk_blocks ADD FOREIGN KEY (workspace_id, run_id, chunk_id) REFERENCES chunks(workspace_id, run_id, id)',
        'ALTER TABLE chunk_blocks ADD FOREIGN KEY (workspace_id, run_id, document_block_id) REFERENCES document_blocks(workspace_id, processing_run_id, id)',
        'ALTER TABLE chunk_embeddings ADD FOREIGN KEY (workspace_id, chunk_id) REFERENCES chunks(workspace_id, id)',
      ]
      for (const statement of sql) await db.rawQuery(statement)
    })
  }
  async down() {
    // Drop referencing tenant columns first; retain original parent relationships.
    this.defer(async (db) => {
      for (const name of [...this.tables].reverse())
        await db.rawQuery(`ALTER TABLE ${name} DROP COLUMN workspace_id CASCADE`)
      await db.rawQuery('ALTER TABLE chunk_blocks DROP COLUMN run_id')
      await db.rawQuery('ALTER TABLE users DROP COLUMN last_workspace_id')
    })
  }
}
