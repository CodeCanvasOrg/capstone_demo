import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Personal model-provider API keys and connector credentials. Secrets are
 * encrypted with the app key; only a short hint is kept in clear text.
 */
export default class extends BaseSchema {
  protected tableName = 'user_credentials'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.integer('user_id').notNullable().references('users.id').onDelete('CASCADE')
      table.string('kind', 16).notNullable()
      table.string('provider', 32).notNullable()
      table.string('label', 80).nullable()
      table.text('encrypted_secret').notNullable()
      table.string('hint', 16).notNullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['user_id', 'kind', 'provider'])
    })
    this.schema.raw(
      `ALTER TABLE user_credentials ADD CONSTRAINT user_credentials_kind_check CHECK (kind IN ('model','connector'))`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
