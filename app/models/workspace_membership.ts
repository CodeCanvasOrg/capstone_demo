import { WorkspaceMembershipSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Workspace from '#models/workspace'
import User from '#models/user'

export default class WorkspaceMembership extends WorkspaceMembershipSchema {
  @belongsTo(() => Workspace) declare workspace: BelongsTo<typeof Workspace>
  @belongsTo(() => User) declare user: BelongsTo<typeof User>
}
