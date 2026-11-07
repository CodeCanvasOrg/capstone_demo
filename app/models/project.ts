import { ProjectSchema } from '#database/schema'
import { column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import File from '#models/file'
export default class Project extends ProjectSchema {
  @column() declare descriptionContent: TipTapDocument | null

  @manyToMany(() => File, {
    pivotTable: 'project_files',
    pivotForeignKey: 'project_id',
    pivotRelatedForeignKey: 'file_id',
    pivotTimestamps: true,
  })
  declare files: ManyToMany<typeof File>
}
