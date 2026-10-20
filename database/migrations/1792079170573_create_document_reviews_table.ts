import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('document_reviews', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.uuid('workspace_id').notNullable()
      t.uuid('document_id').notNullable()
      t.uuid('version_id').notNullable()
      t.integer('submitted_by_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      t.string('input_hash', 64).notNullable()
      t.jsonb('source_pins').notNullable()
      t.timestamp('invalidated_at', { useTz: true }).nullable()
      t.string('invalidation_reason', 255).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['workspace_id', 'document_id', 'id'])
      t.unique(['workspace_id', 'document_id', 'id', 'version_id'])
      t.foreign(['workspace_id', 'document_id'])
        .references(['workspace_id', 'id'])
        .inTable('documents')
        .onDelete('CASCADE')
      t.foreign(['workspace_id', 'document_id', 'version_id'])
        .references(['workspace_id', 'document_id', 'id'])
        .inTable('document_versions')
        .onDelete('CASCADE')
    })
  }
  async down() {
    this.schema.dropTable('document_reviews')
  }
}
