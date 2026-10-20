import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('documents', (table) => {
      table.timestamp('legacy_tenancy_migrated_at', { useTz: true }).nullable()
    })
  }
  async down() {
    this.schema.alterTable('documents', (table) => {
      table.dropColumn('legacy_tenancy_migrated_at')
    })
  }
}
