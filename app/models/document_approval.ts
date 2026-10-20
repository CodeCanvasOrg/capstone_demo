import { DocumentApprovalSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'
export default class DocumentApproval extends DocumentApprovalSchema {
  @column({ prepare: (value: string[]) => JSON.stringify(value) })
  declare warningAcknowledgments: string[]
}
