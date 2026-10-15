import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import User from '#models/user'
import Workspace from '#models/workspace'
import WorkspaceMembership from '#models/workspace_membership'

export default class WorkspaceService {
  async register(payload: { fullName?: string | null; email: string; password: string }) {
    return db.transaction(async (trx) => {
      const user = await User.create(
        { ...payload, email: payload.email.trim().toLowerCase() },
        { client: trx }
      )
      await this.initial(user, trx)
      return user
    })
  }

  async provisionInitial(userId: number) {
    return db.transaction(async (trx) => {
      const user = await User.query({ client: trx }).where('id', userId).forUpdate().firstOrFail()
      return this.initial(user, trx)
    })
  }

  private async initial(user: User, trx: TransactionClientContract) {
    const existing = await Workspace.query({ client: trx })
      .where('initialForUserId', user.id)
      .first()
    // Existing provisioning is never an excuse to restore a revoked membership.
    if (existing) return existing
    return this.createFor(user, `${user.fullName?.trim() || 'My'} workspace`, trx, true)
  }

  async create(userId: number, name: string) {
    return db.transaction(async (trx) => {
      const user = await User.query({ client: trx }).where('id', userId).forUpdate().firstOrFail()
      return this.createFor(user, name, trx)
    })
  }

  private async createFor(
    user: User,
    name: string,
    trx: TransactionClientContract,
    initial = false
  ) {
    const workspace = await Workspace.create(
      { name, ownerUserId: user.id, initialForUserId: initial ? user.id : null },
      { client: trx }
    )
    await WorkspaceMembership.create(
      { workspaceId: workspace.id, userId: user.id, role: 'owner', authorizationEpoch: 0 },
      { client: trx }
    )
    user.useTransaction(trx)
    user.lastWorkspaceId = workspace.id
    await user.save()
    return workspace
  }
}
