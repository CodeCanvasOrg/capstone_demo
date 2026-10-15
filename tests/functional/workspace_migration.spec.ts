import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import User from '#models/user'
import Document from '#models/document'
import DocumentShare from '#models/document_share'
import Workspace from '#models/workspace'
import MigrationService from '#services/workspaces/migration_service'

test.group('Workspace migration', (group) => {
  group.each.setup(async () => {
    if (!env.get('TEST_DB_URL')?.endsWith('/capstone_tenancy_test'))
      throw new Error('Requires explicit disposable capstone_tenancy_test database')
    await db.rawQuery('TRUNCATE users CASCADE')
  })
  test('audits, dry-runs and preserves original IDs through repeated backfill', async ({
    assert,
  }) => {
    const user = await User.create({ email: 'legacy@example.test', password: 'test-password-123' })
    const document = await Document.create({ userId: user.id, title: 'Legacy', status: 'approved' })
    const service = new MigrationService()
    const audit = await service.audit()
    await service.backfill({ auditFingerprint: audit.fingerprint }, false)
    const result1 = await Workspace.all()
    assert.equal(result1.length, 0)
    await document.refresh()
    assert.isNull(document.workspaceId)
    await service.backfill({ auditFingerprint: audit.fingerprint }, true)
    await document.refresh()
    assert.isNotNull(document.workspaceId)
    assert.isTrue(document.legacyApprovalUnverified)
    assert.equal(document.legacyStatus, 'approved')
    assert.equal(document.status, 'edited')
    const nextAudit = await service.audit()
    await service.backfill({ auditFingerprint: nextAudit.fingerprint }, true)
    const result2 = await Workspace.all()
    assert.equal(result2.length, 1)
    const verification = await service.verify()
    assert.isTrue(verification.valid)
  })
  test('refuses unresolved historic sharing and stale audit fingerprints', async ({ assert }) => {
    const alice = await User.create({ email: 'alice@example.test', password: 'test-password-123' })
    const bob = await User.create({ email: 'bob@example.test', password: 'test-password-123' })
    const document = await Document.create({ userId: alice.id, title: 'Private', status: 'draft' })
    const service = new MigrationService()
    const old = await service.audit()
    const share = await DocumentShare.create({
      documentId: document.id,
      userId: bob.id,
      role: 'edit',
    })
    await assert.rejects(
      () => service.backfill({ auditFingerprint: old.fingerprint }, true),
      /Audit changed/
    )
    const audit = await service.audit()
    await assert.rejects(
      () => service.backfill({ auditFingerprint: audit.fingerprint }, true),
      /Unresolved/
    )
    const result3 = await Workspace.all()
    assert.equal(result3.length, 0)
    await service.backfill(
      {
        auditFingerprint: audit.fingerprint,
        shareResolutions: {
          [share.id]: {
            action: 'retire',
            reason: 'Owner reviewed loss of legacy document-only access',
          },
        },
      },
      true
    )
    assert.isNotNull(await DocumentShare.find(share.id))
    const result4 = await db.from('workspace_memberships').where('user_id', bob.id)
    assert.equal(result4.length, 1)
  })
  test('database rejects a project reference from another workspace', async ({ assert }) => {
    const user = await User.create({
      email: 'constraints@example.test',
      password: 'test-password-123',
    })
    const [a, b] = await Workspace.createMany([
      { name: 'A', ownerUserId: user.id },
      { name: 'B', ownerUserId: user.id },
    ])
    const [project] = await db
      .table('projects')
      .insert({ workspace_id: b.id, name: 'B project', creator_id: user.id })
      .returning('id')
    await assert.rejects(() =>
      Document.create({
        userId: user.id,
        workspaceId: a.id,
        projectId: project.id,
        title: 'Mismatch',
      })
    )
  })
})
