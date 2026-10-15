import factory from '@adonisjs/lucid/factories'
import WorkspaceInvitation from '#models/workspace_invitation'

export const WorkspaceInvitationFactory = factory
  .define(WorkspaceInvitation, async ({ faker }) => {
    return { email: faker.internet.email().toLowerCase() }
  })
  .build()
