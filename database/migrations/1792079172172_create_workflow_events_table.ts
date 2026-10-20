import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('workflow_events', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.uuid('workspace_id').notNullable()
      t.uuid('document_id').notNullable()
      t.integer('actor_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      t.string('operation', 32).notNullable()
      t.uuid('mutation_id').notNullable()
      t.string('request_hash', 64).notNullable()
      t.jsonb('result').notNullable().defaultTo('{}')
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['workspace_id', 'document_id', 'actor_id', 'operation', 'mutation_id'])
      t.foreign(['workspace_id', 'document_id'])
        .references(['workspace_id', 'id'])
        .inTable('documents')
        .onDelete('CASCADE')
    })
  }
  async down() {
    this.schema.dropTable('workflow_events')
  }
}
