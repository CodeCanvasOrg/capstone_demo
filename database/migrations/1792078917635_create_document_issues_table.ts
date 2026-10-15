import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('document_issues', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.uuid('workspace_id')
        .notNullable()
        .references('id')
        .inTable('workspaces')
        .onDelete('CASCADE')
      t.uuid('document_id').notNullable()
      t.string('title', 255).notNullable()
      t.text('description').nullable()
      t.boolean('blocking').notNullable().defaultTo(false)
      t.string('state', 12).notNullable().defaultTo('open').checkIn(['open', 'resolved'])
      t.integer('created_by_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      t.integer('updated_by_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      t.integer('resolved_by_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      t.timestamp('resolved_at', { useTz: true }).nullable()
      t.integer('revision').notNullable().defaultTo(0)
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['workspace_id', 'id'])
      t.foreign(['workspace_id', 'document_id'])
        .references(['workspace_id', 'id'])
        .inTable('documents')
        .onDelete('CASCADE')
      t.index(['workspace_id', 'document_id', 'state'])
      t.check(
        "(state='open' AND resolved_at IS NULL AND resolved_by_id IS NULL) OR (state='resolved' AND resolved_at IS NOT NULL AND resolved_by_id IS NOT NULL)"
      )
    })
  }
  async down() {
    this.schema.dropTable('document_issues')
  }
}
