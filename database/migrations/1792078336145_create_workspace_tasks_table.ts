import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('workspace_tasks', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table
        .uuid('workspace_id')
        .notNullable()
        .references('id')
        .inTable('workspaces')
        .onDelete('CASCADE')
      table
        .integer('actor_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.uuid('membership_id').notNullable()
      table.integer('membership_epoch').notNullable()
      table.string('kind', 32).notNullable().checkIn(['ingest', 'generate', 'render'])
      table.uuid('document_id').nullable()
      table.uuid('file_id').nullable()
      table.uuid('run_id').nullable()
      table.uuid('mutation_id').notNullable()
      table.string('request_hash', 64).notNullable()
      table.jsonb('payload').notNullable().defaultTo('{}')
      table
        .string('status', 20)
        .notNullable()
        .defaultTo('queued')
        .checkIn(['queued', 'running', 'succeeded', 'failed', 'cancelled', 'conflict'])
      table.integer('attempts').notNullable().defaultTo(0)
      table.uuid('lease_token').nullable()
      table.timestamp('lease_expires_at', { useTz: true }).nullable()
      table.string('safe_error', 255).nullable()
      table.jsonb('result').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['workspace_id', 'id'])
      table.unique(['workspace_id', 'actor_id', 'kind', 'mutation_id'])
      table
        .foreign(['workspace_id', 'membership_id'])
        .references(['workspace_id', 'id'])
        .inTable('workspace_memberships')
        .onDelete('CASCADE')
      table
        .foreign(['workspace_id', 'document_id'])
        .references(['workspace_id', 'id'])
        .inTable('documents')
        .onDelete('CASCADE')
      table
        .foreign(['workspace_id', 'file_id'])
        .references(['workspace_id', 'id'])
        .inTable('files')
        .onDelete('CASCADE')
      table
        .foreign(['workspace_id', 'run_id'])
        .references(['workspace_id', 'id'])
        .inTable('processing_runs')
        .onDelete('CASCADE')
      table.index(['status', 'lease_expires_at'])
      table.check(
        "(kind = 'ingest' AND file_id IS NOT NULL AND run_id IS NOT NULL AND document_id IS NULL) OR (kind IN ('generate','render') AND document_id IS NOT NULL AND file_id IS NULL AND run_id IS NULL)"
      )
    })
  }
  async down() {
    this.schema.dropTable('workspace_tasks')
  }
}
