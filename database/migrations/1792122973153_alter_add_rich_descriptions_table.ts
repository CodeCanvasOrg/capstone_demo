import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    for (const name of ['projects', 'documents'])
      this.schema.alterTable(name, (table) => table.jsonb('description_content').nullable())
  }
  async down() {
    for (const name of ['projects', 'documents'])
      this.schema.alterTable(name, (table) => table.dropColumn('description_content'))
  }
}
