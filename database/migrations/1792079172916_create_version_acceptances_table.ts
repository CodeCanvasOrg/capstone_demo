import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('version_acceptances', (t) => {
      t.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      t.uuid('workspace_id').notNullable()
      t.uuid('document_id').notNullable()
      t.uuid('version_id').notNullable()
      t.integer('actor_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      t.uuid('mutation_id').notNullable()
      t.string('request_hash', 64).notNullable()
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      t.unique(['workspace_id', 'document_id', 'actor_id', 'mutation_id'])
      t.foreign(['workspace_id', 'document_id', 'version_id'])
        .references(['workspace_id', 'document_id', 'id'])
        .inTable('document_versions')
        .onDelete('CASCADE')
    })
    this.defer(async (db) => {
      await db.rawQuery(
        'INSERT INTO version_acceptances(workspace_id,document_id,version_id,actor_id,mutation_id,request_hash) SELECT workspace_id,document_id,id,user_id,mutation_id,request_hash FROM document_versions WHERE workspace_id IS NOT NULL AND mutation_id IS NOT NULL AND request_hash IS NOT NULL'
      )
    })
  }
  async down() {
    this.schema.dropTable('version_acceptances')
  }
}
