import { BaseSchema } from '@adonisjs/lucid/schema'

/** PRT-01/02/04: collection manifests; approval is bound to the manifest hash. */
export default class extends BaseSchema {
  protected tableName = 'portfolio_collections'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      table.string('name', 120).notNullable()
      table.jsonb('manifest').notNullable()
      table.string('manifest_hash', 64).notNullable()
      table.string('status', 16).notNullable().defaultTo('draft')
      table.string('approved_hash', 64).nullable()
      table.integer('approved_by').nullable().references('users.id').onDelete('SET NULL')
      table.timestamp('approved_at', { useTz: true }).nullable()
      table.integer('created_by').nullable().references('users.id').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['workspace_id', 'updated_at'])
    })
    this.schema.raw(
      `ALTER TABLE portfolio_collections ADD CONSTRAINT portfolio_collections_status_check CHECK (status IN ('draft','approved'))`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
