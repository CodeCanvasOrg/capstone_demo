import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('workspace_invitations', (t) => {
      t.text('delivery_token_encrypted').nullable()
      t.integer('delivery_attempts').notNullable().defaultTo(0)
      t.timestamp('sent_at', { useTz: true }).nullable()
    })
  }
  async down() {
    this.schema.alterTable('workspace_invitations', (t) =>
      t.dropColumns('delivery_token_encrypted', 'delivery_attempts', 'sent_at')
    )
  }
}
