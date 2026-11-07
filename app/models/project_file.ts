import { ProjectFileSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import File from '#models/file'
import Project from '#models/project'

export default class ProjectFile extends ProjectFileSchema {
  @belongsTo(() => Project) declare project: BelongsTo<typeof Project>
  @belongsTo(() => File) declare file: BelongsTo<typeof File>
}
