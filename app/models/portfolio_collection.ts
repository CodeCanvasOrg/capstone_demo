import { PortfolioCollectionSchema } from '#database/schema'
import type { Manifest } from '../../shared/layout/collection.ts'

export default class PortfolioCollection extends PortfolioCollectionSchema {
  declare manifest: Manifest
}
