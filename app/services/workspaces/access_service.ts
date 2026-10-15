import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import WorkspaceMembership from '#models/workspace_membership'
import type Workspace from '#models/workspace'
import Document from '#models/document'
import File from '#models/file'
import Project from '#models/project'
import type User from '#models/user'

export type WorkspaceAccessContext = Readonly<{
  actorId: number
  workspaceId: string
  membershipId: string
  membershipEpoch: number
}>
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const missingResource = () =>
  new Exception('Resource unavailable', { status: 404, code: 'E_RESOURCE_UNAVAILABLE' })
export const conflict = (message: string) =>
  new Exception(message, { status: 409, code: 'E_WORKSPACE_CONFLICT' })

export const uuid = (value: unknown): value is string =>
  typeof value === 'string' && uuidPattern.test(value)

export default class AccessService {
  async resolve(actorId: number, workspaceId: string) {
    if (!uuidPattern.test(workspaceId ?? '')) throw missingResource()
    const membership = await WorkspaceMembership.query()
      .where({ userId: actorId, workspaceId })
      .whereNull('revokedAt')
      .preload('workspace')
      .first()
    if (!membership) throw missingResource()
    const context: WorkspaceAccessContext = Object.freeze({
      actorId,
      workspaceId,
      membershipId: membership.id,
      membershipEpoch: membership.authorizationEpoch,
    })
    return { context, membership, workspace: membership.workspace }
  }
  async active(actorId: number, workspaceId: string | null) {
    if (!workspaceId || !uuidPattern.test(workspaceId)) return false
    return !!(await WorkspaceMembership.query()
      .where({ userId: actorId, workspaceId })
      .whereNull('revokedAt')
      .first())
  }
  async lock(context: WorkspaceAccessContext, trx: TransactionClientContract) {
    const membership = await WorkspaceMembership.query({ client: trx })
      .where({
        id: context.membershipId,
        userId: context.actorId,
        workspaceId: context.workspaceId,
      })
      .forUpdate()
      .first()
    if (
      !membership ||
      membership.revokedAt ||
      membership.authorizationEpoch !== context.membershipEpoch
    )
      throw missingResource()
    return membership
  }
  async document(context: WorkspaceAccessContext, id: string) {
    if (!uuidPattern.test(id ?? '')) throw missingResource()
    return Document.query().where({ id, workspaceId: context.workspaceId }).firstOrFail()
  }
  async file(context: WorkspaceAccessContext, id: string) {
    if (!uuidPattern.test(id ?? '')) throw missingResource()
    return File.query().where({ id, workspaceId: context.workspaceId }).firstOrFail()
  }
  async project(context: WorkspaceAccessContext, id: string) {
    if (!uuidPattern.test(id ?? '')) throw missingResource()
    return Project.query().where({ id, workspaceId: context.workspaceId }).firstOrFail()
  }
  async destination(user: User) {
    const memberships = await WorkspaceMembership.query()
      .where('userId', user.id)
      .whereNull('revokedAt')
      .preload('workspace')
      .orderBy('joinedAt', 'asc')
    return (
      memberships.find((m) => m.workspaceId === user.lastWorkspaceId)?.workspaceId ??
      memberships.find((m) => m.workspace.initialForUserId === user.id)?.workspaceId ??
      memberships[0]?.workspaceId ??
      null
    )
  }
  async owner(actorId: number, workspace: Workspace) {
    return workspace.ownerUserId === actorId && this.active(actorId, workspace.id)
  }
}
