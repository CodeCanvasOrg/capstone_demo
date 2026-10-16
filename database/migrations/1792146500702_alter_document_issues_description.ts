import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_issues'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('description_content').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('description_content')
    })
  }
}
