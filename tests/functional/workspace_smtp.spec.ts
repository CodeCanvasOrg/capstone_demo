import { test } from '@japa/runner'
import env from '#start/env'
import mail from '@adonisjs/mail/services/main'
import InvitationService from '#services/workspaces/invitation_service'
import { account, reset } from '../helpers/workspaces.ts'
const localCapture =
  process.env.VERIFY_LOCAL_SMTP === 'true' &&
  env.get('SMTP_HOST') === '127.0.0.1' &&
  env.get('SMTP_PORT') === 1026
test.group('Local SMTP invitation delivery', (group) => {
  group.each.setup(reset)
  test('Adonis Mail delivers a retryable invitation through real local SMTP', async ({
    assert,
  }) => {
    mail.restore()
    const owner = await account('smtp-owner@example.test')
    const invitation = await new InvitationService().manage(
      owner.context,
      'smtp-recipient@example.test'
    )
    await invitation.refresh()
    assert.equal(invitation.deliveryState, 'sent')
    assert.isNull(invitation.acceptedAt)
    const response = await fetch('http://127.0.0.1:8026/api/v1/messages')
    const capture = (await response.json()) as {
      messages: { To: { Address: string }[]; Subject: string }[]
    }
    assert.isTrue(
      capture.messages.some((message) =>
        message.To.some((recipient) => recipient.Address === 'smtp-recipient@example.test')
      )
    )
  }).skip(!localCapture)
})
