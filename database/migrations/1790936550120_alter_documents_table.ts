import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('generation_status', 24).notNullable().defaultTo('ready')
      table.text('generation_error').nullable()
      table.timestamp('generation_lease_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('generation_error')
      table.dropColumn('generation_lease_at')
      table.dropColumn('generation_status')
    })
  }
}
