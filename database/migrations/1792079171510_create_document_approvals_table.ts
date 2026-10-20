import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('document_approvals', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.uuid('workspace_id').notNullable()
      t.uuid('document_id').notNullable()
      t.uuid('review_id').notNullable()
      t.uuid('version_id').notNullable()
      t.integer('approved_by_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      t.jsonb('warning_acknowledgments').notNullable().defaultTo('[]')
      t.timestamp('invalidated_at', { useTz: true }).nullable()
      t.string('invalidation_reason', 255).nullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['workspace_id', 'document_id', 'id'])
      t.foreign(['workspace_id', 'document_id', 'review_id', 'version_id'])
        .references(['workspace_id', 'document_id', 'id', 'version_id'])
        .inTable('document_reviews')
        .onDelete('CASCADE')
    })
  }
  async down() {
    this.schema.dropTable('document_approvals')
  }
}
