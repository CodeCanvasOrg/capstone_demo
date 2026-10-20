import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('documents', (t) => {
      t.uuid('generation_task_id').nullable()
      t.foreign(['workspace_id', 'generation_task_id'])
        .references(['workspace_id', 'id'])
        .inTable('workspace_tasks')
        .deferrable('deferred')
    })
  }
  async down() {
    this.schema.alterTable('documents', (t) => {
      t.dropForeign(['workspace_id', 'generation_task_id'])
      t.dropColumn('generation_task_id')
    })
  }
}
