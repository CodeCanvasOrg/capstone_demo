import { LayoutPresetSchema } from '#database/schema'
import type { LayoutOptions } from '../../shared/layout/templates.ts'

export default class LayoutPreset extends LayoutPresetSchema {
  declare options: LayoutOptions
}
