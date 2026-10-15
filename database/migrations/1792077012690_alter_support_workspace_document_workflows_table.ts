import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery('ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check')
      await db.rawQuery(
        "ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (status IN ('pending','draft','editing','edited','in_review','approved'))"
      )
    })
    this.schema.alterTable('chunks', (table) => {
      table.boolean('tenancy_quarantined').notNullable().defaultTo(false)
    })
  }
  async down() {
    // Do not silently coerce collaborative workflow states back into the old enum.
    this.schema.alterTable('chunks', (table) => {
      table.dropColumn('tenancy_quarantined')
    })
  }
}
