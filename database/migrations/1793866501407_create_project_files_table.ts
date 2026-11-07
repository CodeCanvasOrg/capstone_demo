import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'project_files'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      table.uuid('project_id').notNullable()
      table.uuid('file_id').notNullable()
      table.integer('created_by').nullable().references('users.id').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      // Composite references keep both ends inside the link's workspace.
      table
        .foreign(['workspace_id', 'project_id'])
        .references(['workspace_id', 'id'])
        .inTable('projects')
        .onDelete('CASCADE')
      table
        .foreign(['workspace_id', 'file_id'])
        .references(['workspace_id', 'id'])
        .inTable('files')
        .onDelete('CASCADE')
      table.unique(['workspace_id', 'project_id', 'file_id'])
      table.index(['workspace_id', 'file_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
