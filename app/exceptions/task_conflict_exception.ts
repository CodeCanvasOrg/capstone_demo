import { Exception } from '@adonisjs/core/exceptions'

const messages = {
  inputs_changed: 'Inputs changed. Start a new request.',
  source_unavailable:
    'A selected source could not be prepared. Retry source preparation, then generate again.',
  lease_lost: 'This task no longer owns its execution lease. Start a new request.',
} as const

export default class TaskConflictException extends Exception {
  constructor(readonly reason: keyof typeof messages) {
    super(messages[reason], { status: 409, code: 'E_WORKSPACE_CONFLICT' })
  }

  get safeMessage() {
    return messages[this.reason]
  }
}
