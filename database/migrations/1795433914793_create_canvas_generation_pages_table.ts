import { BaseSchema } from '@adonisjs/lucid/schema'

/** The pages of one canvas generation run: what was retrieved, written and cited for each. */
export default class extends BaseSchema {
  protected tableName = 'canvas_generation_pages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('run_id').notNullable().references('canvas_generation_runs.id').onDelete('CASCADE')
      table.uuid('workspace_id').notNullable()
      table.smallint('page_index').notNullable()
      table.string('design_id', 32).notNullable()
      table.string('status', 16).notNullable()
      table.text('purpose').notNullable()
      table.jsonb('queries').notNullable()
      table.specificType('chunk_ids', 'text[]').notNullable().defaultTo('{}')
      table.specificType('cited_chunk_ids', 'text[]').notNullable().defaultTo('{}')
      table.specificType('image_ids', 'uuid[]').notNullable().defaultTo('{}')
      table.jsonb('content').nullable()
      table.integer('word_count').nullable()
      table.decimal('fill_ratio', 4, 3).nullable()
      table.smallint('attempts').notNullable().defaultTo(1)
      table.jsonb('notes').notNullable().defaultTo('[]')
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['run_id', 'page_index'])
      table.index(['workspace_id'])
    })
    this.schema.raw(
      "ALTER TABLE canvas_generation_pages ADD CONSTRAINT canvas_generation_pages_status_check CHECK (status IN ('pending','written','fitted','failed'))"
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
