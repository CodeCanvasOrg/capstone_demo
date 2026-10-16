import { DateTime } from 'luxon'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type WorkspaceInvitation from '#models/workspace_invitation'
export default class WorkspaceInvitationTransformer extends BaseTransformer<WorkspaceInvitation> {
  toObject() {
    return {
      expired: this.resource.expiresAt.toMillis() < DateTime.now().toMillis(),
      ...this.pick(this.resource, [
        'id',
        'email',
        'expiresAt',
        'acceptedAt',
        'revokedAt',
        'deliveryState',
        'sentAt',
        'createdAt',
      ]),
    }
  }
}
