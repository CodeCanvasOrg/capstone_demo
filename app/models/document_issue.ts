import { DocumentIssueSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
export default class DocumentIssue extends DocumentIssueSchema {
  @column() declare descriptionContent: TipTapDocument | null
}
