import { Job, exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import InvitationService from '#services/workspaces/invitation_service'
export default class SendWorkspaceInvitation extends Job<{
  invitationId: string
  tokenHash: string
}> {
  static options: JobOptions = {
    queue: 'mail',
    retry: { maxRetries: 3, backoff: exponentialBackoff({ baseDelay: '5s', maxDelay: '1m' }) },
  }
  async execute() {
    await new InvitationService().deliver(this.payload.invitationId, this.payload.tokenHash)
  }
}
