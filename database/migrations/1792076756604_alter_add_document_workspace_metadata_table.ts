import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('documents', (table) => {
      table.uuid('project_id').nullable()
      table.jsonb('project_information').notNullable().defaultTo('{}')
      table.date('due_date').nullable()
      table.integer('metadata_revision').notNullable().defaultTo(0)
      table.integer('selection_revision').notNullable().defaultTo(0)
      table.enum('source_mode', ['files', 'input_only']).notNullable().defaultTo('files')
      table.uuid('current_version_id').nullable()
      table.string('legacy_status').nullable()
      table.boolean('legacy_approval_unverified').notNullable().defaultTo(false)
      table.unique(['workspace_id', 'id', 'current_version_id'])
      table
        .foreign(['workspace_id', 'project_id'])
        .references(['workspace_id', 'id'])
        .inTable('projects')
      table.index(['workspace_id', 'project_id', 'updated_at'])
    })
    this.schema.alterTable('document_versions', (table) => {
      table.uuid('mutation_id').nullable()
      table.string('request_hash', 64).nullable()
      table.unique(['workspace_id', 'document_id', 'id'])
      table.unique(['document_id', 'user_id', 'mutation_id'])
    })
    this.defer(async (db) => {
      await db.rawQuery(
        'ALTER TABLE documents ADD FOREIGN KEY (workspace_id, id, current_version_id) REFERENCES document_versions(workspace_id, document_id, id) DEFERRABLE INITIALLY DEFERRED'
      )
    })
  }
  async down() {
    this.defer(async (db) => {
      for (const col of [
        'project_id',
        'project_information',
        'due_date',
        'metadata_revision',
        'selection_revision',
        'source_mode',
        'current_version_id',
        'legacy_status',
        'legacy_approval_unverified',
      ])
        await db.rawQuery(`ALTER TABLE documents DROP COLUMN ${col} CASCADE`)
      await db.rawQuery(
        'ALTER TABLE document_versions DROP COLUMN mutation_id CASCADE, DROP COLUMN request_hash'
      )
    })
  }
}
