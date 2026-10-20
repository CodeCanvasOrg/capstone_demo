import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('workspace_invitations', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      table.string('email', 254).notNullable()
      table.integer('inviter_id').notNullable().references('users.id')
      table.string('token_hash', 64).notNullable().unique()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('accepted_at', { useTz: true }).nullable()
      table.timestamp('revoked_at', { useTz: true }).nullable()
      table.integer('accepted_user_id').nullable().references('users.id')
      table.timestamp('email_verified_at', { useTz: true }).nullable()
      table.enum('delivery_state', ['pending', 'sent', 'failed']).notNullable().defaultTo('pending')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['workspace_id', 'id'])
    })
    this.defer(async (db) => {
      await db.rawQuery(
        'CREATE UNIQUE INDEX workspace_pending_invitation ON workspace_invitations (workspace_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL'
      )
    })
  }
  async down() {
    this.schema.dropTable('workspace_invitations')
  }
}
