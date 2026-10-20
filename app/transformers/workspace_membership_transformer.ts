import UserTransformer from '#transformers/user_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type WorkspaceMembership from '#models/workspace_membership'

export default class WorkspaceMembershipTransformer extends BaseTransformer<WorkspaceMembership> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'workspaceId', 'userId', 'role', 'joinedAt', 'revokedAt']),
      user: UserTransformer.transform(this.whenLoaded(this.resource.user)),
    }
  }
}
