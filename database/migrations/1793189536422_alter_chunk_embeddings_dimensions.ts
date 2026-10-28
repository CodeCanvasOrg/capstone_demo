import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Embedding spaces are already keyed by (model, version, dimensions), so the column no longer pins
 * one width. HNSW requires a fixed width, so each supported width gets a partial expression index
 * that retrieval matches with `embedding::vector(n)` and `dimensions = n`.
 */
const INDEXED_DIMENSIONS = [768, 1024] as const

export default class extends BaseSchema {
  protected tableName = 'chunk_embeddings'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS chunk_embeddings_hnsw')
      await db.rawQuery('ALTER TABLE chunk_embeddings ALTER COLUMN embedding TYPE vector')
      for (const dimensions of INDEXED_DIMENSIONS)
        await db.rawQuery(
          `CREATE INDEX chunk_embeddings_hnsw_${dimensions} ON chunk_embeddings USING hnsw ((embedding::vector(${dimensions})) vector_cosine_ops) WHERE dimensions = ${dimensions}`
        )
    })
  }

  async down() {
    this.defer(async (db) => {
      for (const dimensions of INDEXED_DIMENSIONS)
        await db.rawQuery(`DROP INDEX IF EXISTS chunk_embeddings_hnsw_${dimensions}`)
      // The original column only holds 1024 dimensions; other spaces are re-prepared on demand.
      await db.rawQuery('DELETE FROM chunk_embeddings WHERE dimensions <> 1024')
      await db.rawQuery('ALTER TABLE chunk_embeddings ALTER COLUMN embedding TYPE vector(1024)')
      await db.rawQuery(
        'CREATE INDEX chunk_embeddings_hnsw ON chunk_embeddings USING hnsw (embedding vector_cosine_ops)'
      )
    })
  }
}
