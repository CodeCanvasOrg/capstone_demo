import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import { Readable } from 'node:stream'
import { account, reset, source } from '../helpers/workspaces.ts'
import EvidenceService from '#services/documents/evidence_service'
test.group('Private workspace storage', (group) => {
  group.each.setup(reset)
  test('private downloads authorize the route before opening storage', async ({
    assert,
    client,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const asset = await source(a)
    const original = drive.use
    let reads = 0
    drive.use = () =>
      ({
        getStream: async () => {
          reads++
          return Readable.from([Buffer.from('private bytes')])
        },
      }) as any
    try {
      const denied = await client
        .get(`/workspaces/${b.workspace.id}/files/${asset.file.id}/download`)
        .loginAs(b.user)
        .header('accept', 'application/json')
      denied.assertStatus(404)
      assert.equal(reads, 0)
      const guest = await client
        .get(`/workspaces/${a.workspace.id}/files/${asset.file.id}/download`)
        .header('accept', 'application/json')
      guest.assertStatus(401)
      assert.equal(reads, 0)
      const allowed = await client
        .get(`/workspaces/${a.workspace.id}/files/${asset.file.id}/download`)
        .loginAs(a.user)
      allowed.assertStatus(200)
      assert.equal(reads, 1)
      allowed.assertHeader('cache-control', 'private, no-store')
    } finally {
      drive.use = original
    }
  })
  test('evidence payloads have authorized application URLs and no storage keys', async ({
    assert,
    client,
  }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const asset = await source(a, true, true)
    const response = await client
      .get(`/workspaces/${a.workspace.id}/documents/${a.document.id}/evidence/${asset.chunkId}`)
      .loginAs(a.user)
    response.assertStatus(200)
    assert.include(response.body().data.fileUrl, `/workspaces/${a.workspace.id}/documents/`)
    assert.notInclude(JSON.stringify(response.body()), 'old-public')
    assert.notInclude(JSON.stringify(response.body()), asset.file.objectKey!)
    await assert.rejects(() => new EvidenceService().chunk(b.context, a.document.id, asset.chunkId))
  })
})
