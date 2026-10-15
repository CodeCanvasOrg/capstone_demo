import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('workspace_memberships', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      table.integer('user_id').notNullable().references('users.id')
      table.enum('role', ['owner', 'member']).notNullable().defaultTo('member')
      table.integer('authorization_epoch').notNullable().defaultTo(0)
      table.timestamp('revoked_at', { useTz: true }).nullable()
      table.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['workspace_id', 'user_id'])
      table.unique(['workspace_id', 'id'])
      table.index(['user_id', 'revoked_at'])
      table.check('authorization_epoch >= 0')
    })
    this.defer(async (db) => {
      await db.rawQuery(
        "CREATE UNIQUE INDEX workspace_single_owner ON workspace_memberships (workspace_id) WHERE role = 'owner'"
      )
    })
  }
  async down() {
    this.schema.dropTable('workspace_memberships')
  }
}
