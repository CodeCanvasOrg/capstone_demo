import { DocumentReviewSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
import type { SourcePin } from '#services/workspaces/task_service'
export default class DocumentReview extends DocumentReviewSchema {
  @column({ prepare: (value: SourcePin[]) => JSON.stringify(value) })
  declare sourcePins: SourcePin[]
}
