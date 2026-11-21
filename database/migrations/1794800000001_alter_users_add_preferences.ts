import { BaseSchema } from '@adonisjs/lucid/schema'

/** Account-level preferences (editor, AI defaults, notifications, region). */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('preferences').notNullable().defaultTo('{}')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('preferences')
    })
  }
}
