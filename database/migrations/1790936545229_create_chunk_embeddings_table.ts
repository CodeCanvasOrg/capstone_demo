import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chunk_embeddings'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery('CREATE EXTENSION IF NOT EXISTS vector')
    })

    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('chunk_id').references('chunks.id').notNullable().onDelete('CASCADE')
      table.string('model', 255).notNullable()
      table.string('version', 64).notNullable()
      table.integer('dimensions').notNullable()
      // pgvector HNSW indexes support vectors up to 2000 dimensions.
      table.specificType('embedding', 'vector(1024)').notNullable()
      table.string('input_hash', 64).notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.unique(['chunk_id', 'model', 'version', 'dimensions'])
      table.index(['model', 'version', 'dimensions', 'input_hash'])
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'CREATE INDEX chunk_embeddings_hnsw ON chunk_embeddings USING hnsw (embedding vector_cosine_ops)'
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS chunk_embeddings_hnsw')
    })
    this.schema.dropTable(this.tableName)
  }
}
