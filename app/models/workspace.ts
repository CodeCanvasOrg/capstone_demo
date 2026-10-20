import { WorkspaceSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import WorkspaceMembership from '#models/workspace_membership'
import Document from '#models/document'
import File from '#models/file'
import Project from '#models/project'

export default class Workspace extends WorkspaceSchema {
  @hasMany(() => WorkspaceMembership) declare memberships: HasMany<typeof WorkspaceMembership>
  @hasMany(() => Document) declare documents: HasMany<typeof Document>
  @hasMany(() => File) declare files: HasMany<typeof File>
  @hasMany(() => Project) declare projects: HasMany<typeof Project>
}
