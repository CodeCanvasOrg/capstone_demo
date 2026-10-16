import { ProjectSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
export default class Project extends ProjectSchema {
  @column() declare descriptionContent: TipTapDocument | null
}
