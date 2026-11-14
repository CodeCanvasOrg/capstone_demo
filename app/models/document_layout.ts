import { DocumentLayoutSchema } from '#database/schema'
import type { LayoutOptions } from '../../shared/layout/templates.ts'

export default class DocumentLayout extends DocumentLayoutSchema {
  // The document id is the key and is assigned by the caller, not generated.
  static selfAssignPrimaryKey = true
  declare options: LayoutOptions
}
