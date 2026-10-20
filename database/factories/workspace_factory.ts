import factory from '@adonisjs/lucid/factories'
import Workspace from '#models/workspace'

export const WorkspaceFactory = factory
  .define(Workspace, async ({ faker }) => {
    return { name: faker.company.name() }
  })
  .build()
