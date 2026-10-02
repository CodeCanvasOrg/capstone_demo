import { FileSchema } from '#database/schema'
import { belongsTo, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import Document from './document.ts'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Chunk from './chunk.ts'
import User from './user.ts'
import FileRevision from './file_revision.ts'

export default class File extends FileSchema {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare filename: string | null

  @column()
  declare filetype: string | null

  @column()
  declare objectKey: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => Chunk)
  declare chunks: HasMany<typeof Chunk>

  @hasMany(() => FileRevision)
  declare revisions: HasMany<typeof FileRevision>

  @manyToMany(() => Document, {
    pivotTable: 'document_files',
    pivotForeignKey: 'files_id',
    pivotRelatedForeignKey: 'document_id',
    pivotTimestamps: true,
  })
  declare documents: ManyToMany<typeof Document>

  static createFileName(dir: string, end?: string) {
    return `${dir}/${crypto.randomUUID()}-${end ?? 'file'}`
  }
}
