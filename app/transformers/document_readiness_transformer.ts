import { BaseTransformer } from '@adonisjs/core/transformers'
import type { ReadinessStage } from '#services/documents/readiness_service'
type Readiness = {
  stages: ReadinessStage[]
  percentage: number
  warnings: { id: string; text: string }[]
  reviewRequired: boolean
  canExport: boolean
  canSubmit: boolean
  approved: boolean
}
export default class DocumentReadinessTransformer extends BaseTransformer<Readiness> {
  toObject() {
    return this.pick(this.resource, [
      'stages',
      'percentage',
      'warnings',
      'canSubmit',
      'approved',
      'reviewRequired',
      'canExport',
    ])
  }
}
