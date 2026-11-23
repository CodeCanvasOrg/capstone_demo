import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per canvas generation (the academic pipeline). Holds the plan and the
 * quality metrics, so the UI and `canvas:density` report them without re-deriving.
 */
export default class extends BaseSchema {
  protected tableName = 'canvas_generation_runs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE')
      table.uuid('document_id').notNullable().references('documents.id').onDelete('CASCADE')
      table.uuid('task_id').nullable().references('workspace_tasks.id').onDelete('SET NULL')
      table
        .uuid('base_version_id')
        .nullable()
        .references('document_versions.id')
        .onDelete('SET NULL')
      table
        .uuid('result_version_id')
        .nullable()
        .references('document_versions.id')
        .onDelete('SET NULL')
      table.string('profile', 16).notNullable()
      table.string('depth', 16).notNullable()
      table.string('template_set', 32).notNullable()
      table.string('status', 16).notNullable()
      table.string('planner_model', 120).notNullable()
      table.string('writer_model', 120).notNullable()
      table.string('pipeline_version', 32).notNullable()
      table.jsonb('plan').nullable()
      table.jsonb('metrics').nullable()
      table.text('error').nullable()
      table.integer('created_by').nullable().references('users.id').onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.index(['workspace_id'])
    })
    this.schema.raw(
      "ALTER TABLE canvas_generation_runs ADD CONSTRAINT canvas_generation_runs_profile_check CHECK (profile IN ('academic','informative'))"
    )
    this.schema.raw(
      "ALTER TABLE canvas_generation_runs ADD CONSTRAINT canvas_generation_runs_depth_check CHECK (depth IN ('concise','standard','detailed'))"
    )
    this.schema.raw(
      "ALTER TABLE canvas_generation_runs ADD CONSTRAINT canvas_generation_runs_status_check CHECK (status IN ('queued','planning','retrieving','writing','fitting','images','composing','ready','failed'))"
    )
    this.schema.raw(
      'CREATE INDEX canvas_generation_runs_document_idx ON canvas_generation_runs (document_id, created_at DESC)'
    )
    // A document has one active run at a time.
    this.schema.raw(
      "CREATE UNIQUE INDEX canvas_generation_runs_active_key ON canvas_generation_runs (document_id) WHERE status NOT IN ('ready','failed')"
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
