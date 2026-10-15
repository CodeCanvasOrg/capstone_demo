import { randomBytes, createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import env from '#start/env'
import Workspace from '#models/workspace'
import WorkspaceInvitation from '#models/workspace_invitation'
import WorkspaceMembership from '#models/workspace_membership'
import User from '#models/user'
import Notification from '../../mails/workspace_invitation_notification.ts'
import SendWorkspaceInvitation from '../../jobs/send_workspace_invitation.ts'
import AccessService, {
  conflict,
  missingResource,
  uuid,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import { Exception } from '@adonisjs/core/exceptions'
const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex')
export default class InvitationService {
  async manage(context: WorkspaceAccessContext, email: string, id?: string, revoke = false) {
    const invitation = await db.transaction(async (trx) => {
      const workspace = await Workspace.query({ client: trx })
        .where('id', context.workspaceId)
        .forUpdate()
        .firstOrFail()
      await new AccessService().lock(context, trx)
      if (workspace.ownerUserId !== context.actorId)
        throw new Exception('Only the workspace owner manages invitations', { status: 403 })
      if (id && !uuid(id)) throw missingResource()
      let row = id
        ? await WorkspaceInvitation.query({ client: trx })
            .where({ id, workspaceId: context.workspaceId })
            .forUpdate()
            .firstOrFail()
        : await WorkspaceInvitation.query({ client: trx })
            .where({ workspaceId: context.workspaceId, email: email.trim().toLowerCase() })
            .whereNull('acceptedAt')
            .whereNull('revokedAt')
            .forUpdate()
            .first()
      if (row?.acceptedAt || row?.revokedAt) throw conflict('This invitation is no longer pending')
      if (revoke) {
        row!.merge({ revokedAt: DateTime.utc(), deliveryTokenEncrypted: null })
        await row!.save()
        return row!
      }
      const addressed = (row?.email ?? email).trim().toLowerCase()
      const account = await User.query({ client: trx })
        .whereRaw('lower(email)=?', [addressed])
        .first()
      if (
        account &&
        (await WorkspaceMembership.query({ client: trx })
          .where({ workspaceId: workspace.id, userId: account.id })
          .whereNull('revokedAt')
          .first())
      )
        throw conflict('This account is already a member')
      if (!id && row && row.expiresAt > DateTime.utc())
        throw conflict('A pending invitation already exists. Resend or revoke it.')
      const token = randomBytes(32).toString('hex')
      const fields = {
        workspaceId: workspace.id,
        email: addressed,
        inviterId: context.actorId,
        tokenHash: tokenHash(token),
        expiresAt: DateTime.utc().plus({ days: 7 }),
        deliveryState: 'pending',
        deliveryTokenEncrypted: encryption.encrypt(token),
        sentAt: null,
      }
      if (row) {
        row.merge(fields)
        await row.save()
      } else row = await WorkspaceInvitation.create(fields, { client: trx })
      return row
    })
    if (!revoke) {
      try {
        await SendWorkspaceInvitation.dispatch({
          invitationId: invitation.id,
          tokenHash: invitation.tokenHash,
        })
      } catch {
        await WorkspaceInvitation.query()
          .where({ id: invitation.id, tokenHash: invitation.tokenHash })
          .update({ deliveryState: 'failed' })
      }
    }
    return invitation
  }
  async deliver(id: string, hash: string) {
    const row = await WorkspaceInvitation.query().where({ id, tokenHash: hash }).first()
    if (
      !row ||
      row.revokedAt ||
      row.acceptedAt ||
      row.expiresAt <= DateTime.utc() ||
      !row.deliveryTokenEncrypted
    )
      return
    const workspace = await Workspace.findOrFail(row.workspaceId)
    // The inviter must still be an authorized owner at disclosure time.
    if (!(await new AccessService().owner(row.inviterId, workspace))) return
    const token = encryption.decrypt<string>(row.deliveryTokenEncrypted)
    if (!token || tokenHash(token) !== hash) throw new Error('Invitation delivery token is invalid')
    await WorkspaceInvitation.query()
      .where({ id, tokenHash: hash })
      .increment('delivery_attempts', 1)
    try {
      await mail.send(
        new Notification(
          row.email,
          workspace.name,
          new URL(`/invitations/${token}`, env.get('APP_URL')).toString()
        )
      )
      await WorkspaceInvitation.query()
        .where({ id, tokenHash: hash })
        .update({ deliveryState: 'sent', sentAt: DateTime.utc() })
    } catch (error) {
      await WorkspaceInvitation.query()
        .where({ id, tokenHash: hash })
        .update({ deliveryState: 'failed' })
      throw error
    }
  }
  async find(token: string) {
    if (!/^[a-f0-9]{64}$/i.test(token ?? '')) throw missingResource()
    const invitation = await WorkspaceInvitation.query()
      .where('tokenHash', tokenHash(token))
      .first()
    if (!invitation || invitation.revokedAt || invitation.expiresAt <= DateTime.utc())
      throw new Exception('This invitation expired or was revoked', { status: 410 })
    return invitation
  }
  async accept(user: User, token: string) {
    const found = await this.find(token)
    return db.transaction(async (trx) => {
      // Workspace-first order matches owner membership management and invitation rotation.
      const workspace = await Workspace.query({ client: trx })
        .where('id', found.workspaceId)
        .forUpdate()
        .firstOrFail()
      const row = await WorkspaceInvitation.query({ client: trx })
        .where({ id: found.id, tokenHash: tokenHash(token) })
        .forUpdate()
        .firstOrFail()
      if (row.email !== user.email.toLowerCase())
        throw new Exception('Sign in with the addressed email to accept', { status: 403 })
      if (row.revokedAt || row.expiresAt <= DateTime.utc())
        throw new Exception('This invitation expired or was revoked', { status: 410 })
      let membership = await WorkspaceMembership.query({ client: trx })
        .where({ workspaceId: workspace.id, userId: user.id })
        .forUpdate()
        .first()
      if (row.acceptedAt) {
        if (row.acceptedUserId === user.id && membership && !membership.revokedAt) return workspace
        throw conflict('This invitation was already used')
      }
      if (membership) {
        membership.merge({ revokedAt: null, authorizationEpoch: membership.authorizationEpoch + 1 })
        await membership.save()
      } else
        membership = await WorkspaceMembership.create(
          { workspaceId: workspace.id, userId: user.id, role: 'member', authorizationEpoch: 0 },
          { client: trx }
        )
      row.merge({
        acceptedAt: DateTime.utc(),
        acceptedUserId: user.id,
        emailVerifiedAt: DateTime.utc(),
        deliveryTokenEncrypted: null,
      })
      await row.save()
      await User.query({ client: trx })
        .where('id', user.id)
        .update({ lastWorkspaceId: workspace.id })
      return workspace
    })
  }
}
