import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import WorkspaceService from '#services/workspaces/workspace_service'
import AccessService from '#services/workspaces/access_service'
import DocumentService from '#services/documents/document_service'

test.group('Workspace navigation', (group) => {
  group.each.setup(async () => {
    if (!env.get('TEST_DB_URL')?.endsWith('/capstone_tenancy_test'))
      throw new Error('Requires disposable tenancy test database')
    await db.rawQuery('TRUNCATE users CASCADE')
  })
  test('root sends guests to login and authenticated users to authorized preference', async ({
    client,
  }) => {
    const guest = await client.get('/').redirects(0)
    guest.assertStatus(302)
    guest.assertHeader('location', '/login')
    const service = new WorkspaceService()
    const user = await service.register({
      email: 'root@example.test',
      password: 'test-password-123',
    })
    const initial = user.lastWorkspaceId
    const additional = await service.create(user.id, 'Second')
    const selected = await client.get('/').loginAs(user).redirects(0)
    selected.assertHeader('location', `/workspaces/${additional.id}`)
    const other = await service.register({
      email: 'other@example.test',
      password: 'test-password-123',
    })
    user.lastWorkspaceId = other.lastWorkspaceId
    await user.save()
    const fallback = await client.get('/').loginAs(user).redirects(0)
    fallback.assertHeader('location', `/workspaces/${initial}`)
  })
  test('legacy GET resolves an authorized workspace but legacy mutations never write', async ({
    client,
  }) => {
    const service = new WorkspaceService()
    const user = await service.register({
      email: 'legacy@example.test',
      password: 'test-password-123',
    })
    const context = await new AccessService().resolve(user.id, user.lastWorkspaceId!)
    const document = await new DocumentService().create(context.context, { title: 'Canonical' }, [])
    const get = await client.get(`/documents/${document.id}/edit`).loginAs(user).redirects(0)
    get.assertHeader(
      'location',
      `/workspaces/${context.workspace.id}/documents/${document.id}/edit`
    )
    const write = await client
      .patch(`/documents/${document.id}`)
      .loginAs(user)
      .withCsrfToken()
      .json({ title: 'Wrong' })
    write.assertStatus(410)
    const stranger = await service.register({
      email: 'stranger@example.test',
      password: 'test-password-123',
    })
    const denied = await client.get(`/documents/${document.id}/edit`).loginAs(stranger).redirects(0)
    denied.assertStatus(404)
  })
})
