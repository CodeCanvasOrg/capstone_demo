import { BaseTransformer } from '@adonisjs/core/transformers'
import type Workspace from '#models/workspace'

export default class WorkspaceTransformer extends BaseTransformer<Workspace> {
  toObject() {
    return this.pick(this.resource, ['id', 'name', 'ownerUserId'])
  }
}
