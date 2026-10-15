import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import WorkspaceService from '#services/workspaces/workspace_service'
import AccessService from '#services/workspaces/access_service'
import DocumentService from '#services/documents/document_service'
import VersionService from '#services/documents/version_service'
import MembershipService from '#services/workspaces/membership_service'
import WorkspaceMembership from '#models/workspace_membership'
import DocumentShare from '#models/document_share'
import DocumentPolicy from '#policies/document_policy'
import Document from '#models/document'
import File from '#models/file'

test.group('Workspace isolation', (group) => {
  group.each.setup(async () => {
    if (!env.get('TEST_DB_URL')?.endsWith('/capstone_tenancy_test'))
      throw new Error('Requires disposable tenancy test database')
    await db.rawQuery('TRUNCATE users CASCADE')
  })
  async function fixtures() {
    const service = new WorkspaceService()
    const alice = await service.register({
      email: 'alice@example.test',
      password: 'test-password-123',
    })
    const bob = await service.register({ email: 'bob@example.test', password: 'test-password-123' })
    const a = await new AccessService().resolve(alice.id, alice.lastWorkspaceId!)
    const b = await new AccessService().resolve(bob.id, bob.lastWorkspaceId!)
    const document = await new DocumentService().create(a.context, { title: 'Private A' }, [])
    return { alice, bob, a, b, document }
  }
  test('conceals direct and mismatched nested resource reads', async ({ client }) => {
    const { alice, bob, a, b, document } = await fixtures()
    const denied = await client
      .get(`/workspaces/${a.workspace.id}/documents`)
      .loginAs(bob)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    denied.assertStatus(404)
    const mismatch = await client
      .get(`/workspaces/${b.workspace.id}/documents/${document.id}/edit`)
      .loginAs(bob)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    mismatch.assertStatus(404)
    const own = await client
      .get(`/workspaces/${a.workspace.id}/documents`)
      .loginAs(alice)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    own.assertStatus(200)
    own.assertBodyContains({ props: { documents: [{ title: 'Private A' }] } })
  })
  test('all members collaborate but old shares never bypass membership', async ({
    assert,
    client,
  }) => {
    const { alice, bob, a, document } = await fixtures()
    await DocumentShare.create({ documentId: document.id, userId: bob.id, role: 'edit' })
    assert.isFalse(await new DocumentPolicy().update(bob, document))
    const member = await WorkspaceMembership.create({
      workspaceId: a.workspace.id,
      userId: bob.id,
      role: 'member',
      authorizationEpoch: 0,
    })
    assert.isTrue(await new DocumentPolicy().update(bob, document))
    assert.isFalse(await new DocumentPolicy().delete(bob, document))
    const listing = await client
      .get(`/workspaces/${a.workspace.id}/documents`)
      .loginAs(bob)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    listing.assertStatus(200)
    assert.equal(listing.body().props.documents[0].userId, alice.id)
    const old = await new AccessService().resolve(bob.id, a.workspace.id)
    await new MembershipService().revoke(a.context, member.id)
    assert.isFalse(await new DocumentPolicy().edit(bob, document))
    await assert.rejects(() =>
      new DocumentService().create(old.context, { title: 'Revoked write' }, [])
    )
  })
  test('rejects cross-workspace sources and keeps uploader-only file mutation', async ({
    assert,
    client,
  }) => {
    const { alice, bob, a, b } = await fixtures()
    const file = await File.create({
      workspaceId: a.workspace.id,
      userId: alice.id,
      filename: 'A source.txt',
    })
    await assert.rejects(() =>
      new DocumentService().create(b.context, { title: 'B', sourceMode: 'files' }, [file.id])
    )
    await WorkspaceMembership.create({
      workspaceId: a.workspace.id,
      userId: bob.id,
      role: 'member',
      authorizationEpoch: 0,
    })
    const read = await client
      .get(`/workspaces/${a.workspace.id}/files/${file.id}/edit`)
      .loginAs(bob)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    read.assertStatus(200)
    const rename = await client
      .patch(`/workspaces/${a.workspace.id}/files/${file.id}`)
      .loginAs(bob)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ filename: 'Stolen' })
    rename.assertStatus(403)
    const forged = await client
      .patch(`/workspaces/${b.workspace.id}/files/${file.id}`)
      .loginAs(bob)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ filename: 'Stolen' })
    forged.assertStatus(404)
  })
  test('scopes search results and never serializes storage locators', async ({
    assert,
    client,
  }) => {
    const { alice, bob, a, b } = await fixtures()
    await new DocumentService().create(b.context, { title: 'Private B' }, [])
    await File.create({
      workspaceId: a.workspace.id,
      userId: alice.id,
      filename: 'Secret file',
      objectKey: 'private/key',
      objectUrl: 'https://invalid.test/public/key',
    })
    const results = await client
      .get(`/workspaces/${a.workspace.id}/documents?q=Private`)
      .loginAs(alice)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    results.assertStatus(200)
    assert.equal(results.body().props.documents.length, 1)
    assert.equal(results.body().props.pagination.total, 1)
    const files = await client
      .get(`/workspaces/${a.workspace.id}/files`)
      .loginAs(alice)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    files.assertStatus(200)
    assert.notInclude(JSON.stringify(files.body()), 'private/key')
    assert.notInclude(JSON.stringify(files.body()), '/public/key')
    assert.notEqual(alice.id, bob.id)
  })
  test('concurrent saves compare exact base versions and mutation replay is duplicate-safe', async ({
    assert,
  }) => {
    const { a, document } = await fixtures()
    const service = new VersionService()
    const payload = (text: string) => ({
      baseVersionId: null,
      mutationId: crypto.randomUUID(),
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
    })
    const input = payload('One')
    const results = await Promise.allSettled([
      service.save(a.context, document.id, input),
      service.save(a.context, document.id, payload('Two')),
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(results.filter((r) => r.status === 'rejected').length, 1)
    const versions = await document.related('documentVersions').query()
    assert.equal(versions.length, 1)
    if (results[0].status === 'fulfilled') {
      const replay = await service.save(a.context, document.id, input)
      assert.equal(replay.id, results[0].value.id)
    }
    assert.isNotNull(await Document.find(document.id))
  })
})
