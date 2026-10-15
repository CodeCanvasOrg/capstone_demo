import { BaseSchema } from '@adonisjs/lucid/schema'
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('documents', (t) => {
      t.uuid('active_review_id').nullable()
      t.uuid('active_approval_id').nullable()
      t.foreign(['workspace_id', 'id', 'active_review_id'])
        .references(['workspace_id', 'document_id', 'id'])
        .inTable('document_reviews')
        .deferrable('deferred')
      t.foreign(['workspace_id', 'id', 'active_approval_id'])
        .references(['workspace_id', 'document_id', 'id'])
        .inTable('document_approvals')
        .deferrable('deferred')
    })
  }
  async down() {
    this.schema.alterTable('documents', (t) => {
      t.dropForeign(['workspace_id', 'id', 'active_review_id'])
      t.dropForeign(['workspace_id', 'id', 'active_approval_id'])
      t.dropColumns('active_review_id', 'active_approval_id')
    })
  }
}
