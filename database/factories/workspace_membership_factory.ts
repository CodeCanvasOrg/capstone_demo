import factory from '@adonisjs/lucid/factories'
import WorkspaceMembership from '#models/workspace_membership'

export const WorkspaceMembershipFactory = factory
  .define(WorkspaceMembership, async () => {
    return { role: 'member', authorizationEpoch: 0 }
  })
  .build()
