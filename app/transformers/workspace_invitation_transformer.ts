import { BaseTransformer } from '@adonisjs/core/transformers'
import type WorkspaceInvitation from '#models/workspace_invitation'
export default class WorkspaceInvitationTransformer extends BaseTransformer<WorkspaceInvitation> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'email',
      'expiresAt',
      'acceptedAt',
      'revokedAt',
      'deliveryState',
      'sentAt',
      'createdAt',
    ])
  }
}
