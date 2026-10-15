import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import Workspace from '#models/workspace'
import WorkspaceMembership from '#models/workspace_membership'
import AccessService, {
  missingResource,
  uuid,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'

export default class MembershipService {
  async revoke(context: WorkspaceAccessContext, membershipId: string) {
    if (!uuid(membershipId)) throw missingResource()
    return db.transaction(async (trx) => {
      // Serialize workspace membership management before individual membership locks.
      const workspace = await Workspace.query({ client: trx })
        .where('id', context.workspaceId)
        .forUpdate()
        .firstOrFail()
      await new AccessService().lock(context, trx)
      if (workspace.ownerUserId !== context.actorId)
        throw new Exception('Only the workspace owner manages membership', { status: 403 })
      const member = await WorkspaceMembership.query({ client: trx })
        .where({ id: membershipId, workspaceId: context.workspaceId })
        .forUpdate()
        .first()
      if (!member) throw missingResource()
      if (member.userId === workspace.ownerUserId)
        throw new Exception('Workspace owner cannot be removed', { status: 409 })
      if (member.revokedAt) return
      member.merge({ revokedAt: DateTime.utc(), authorizationEpoch: member.authorizationEpoch + 1 })
      await member.save()
    })
  }
}
