import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import ace from '@adonisjs/core/services/ace'
import WorkspaceMembership from '#models/workspace_membership'
import DocumentService from '#services/documents/document_service'
import SourceSelectionService from '#services/documents/source_selection_service'
import ProjectFilesService from '#services/files/project_files_service'
import ProjectService from '#services/workspaces/project_service'
import UploadService from '#services/upload_service'
import LinkProjectFiles from '../../commands/link_project_files.ts'
import VerifyProjectFiles from '../../commands/verify_project_files.ts'
import { account, reset, source } from '../helpers/workspaces.ts'

type Owner = Awaited<ReturnType<typeof account>>
const project = (owner: Owner, name: string) => new ProjectService().save(owner.context, { name })
const link = (owner: Owner, fileId: string, projectId: string) =>
  db.table('project_files').insert({
    workspace_id: owner.workspace.id,
    project_id: projectId,
    file_id: fileId,
  })
const caseStudy = (owner: Owner, projectId: string | null, fileIds: string[] = []) =>
  new DocumentService().create(
    owner.context,
    { title: 'Scoped', projectId, sourceMode: fileIds.length ? 'files' : 'input_only' },
    fileIds
  )

test.group('Project files', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => drive.restore())

  test('an upload with a project links the file to that project', async ({ assert }) => {
    const a = await account()
    const alpha = await project(a, 'Alpha')
    const uploaded = await new UploadService().upload(a.context, {
      filename: 'brief.txt',
      contents: Buffer.from('brief'),
      projectId: alpha.id,
    })
    assert.deepEqual(uploaded.projectIds, [alpha.id])
    const links = await db.from('project_files').where({ file_id: uploaded.id })
    assert.lengthOf(links, 1)
    assert.equal(links[0].project_id, alpha.id)
    assert.equal(links[0].created_by, a.user.id)
  })

  test('uploading into another workspace project is refused before storage', async ({ assert }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const foreign = await project(b, 'Foreign')
    await assert.rejects(() =>
      new UploadService().upload(a.context, {
        filename: 'brief.txt',
        contents: Buffer.from('brief'),
        projectId: foreign.id,
      })
    )
    assert.lengthOf(await db.from('files').where({ workspace_id: a.workspace.id }), 0)
  })

  test('case studies may select workspace files and their own project files only', async ({
    assert,
  }) => {
    const a = await account()
    const alpha = await project(a, 'Alpha')
    const beta = await project(a, 'Beta')
    const shared = await source(a, false)
    const alphaFile = await source(a, false)
    const betaFile = await source(a, false)
    await link(a, alphaFile.file.id, alpha.id)
    await link(a, betaFile.file.id, beta.id)

    await caseStudy(a, alpha.id, [shared.file.id, alphaFile.file.id])
    await assert.rejects(() => caseStudy(a, alpha.id, [betaFile.file.id]), /another project/)
    await assert.rejects(() => caseStudy(a, null, [alphaFile.file.id]), /another project/)
    await caseStudy(a, null, [shared.file.id])
  })

  test('a file linked to several projects serves each of them', async ({ assert }) => {
    const a = await account()
    const alpha = await project(a, 'Alpha')
    const beta = await project(a, 'Beta')
    const both = await source(a, false)
    await link(a, both.file.id, alpha.id)
    await link(a, both.file.id, beta.id)
    await caseStudy(a, alpha.id, [both.file.id])
    await caseStudy(a, beta.id, [both.file.id])
    await assert.rejects(() => caseStudy(a, null, [both.file.id]), /another project/)
  })

  test('source selection enforces the project rule', async ({ assert }) => {
    const a = await account()
    const alpha = await project(a, 'Alpha')
    const beta = await project(a, 'Beta')
    const betaFile = await source(a, false)
    await link(a, betaFile.file.id, beta.id)
    const document = await caseStudy(a, alpha.id)
    await document.refresh()
    await assert.rejects(
      () =>
        new SourceSelectionService().update(a.context, document.id, {
          baseVersionId: null,
          selectionRevision: document.selectionRevision,
          sourceMode: 'files',
          fileIds: [betaFile.file.id],
        }),
      /another project/
    )
  })

  test('moving a case study away from its project files is refused', async ({ assert }) => {
    const a = await account()
    const alpha = await project(a, 'Alpha')
    const beta = await project(a, 'Beta')
    const alphaFile = await source(a, false)
    await link(a, alphaFile.file.id, alpha.id)
    const document = await caseStudy(a, alpha.id, [alphaFile.file.id])
    await document.refresh()
    await assert.rejects(
      () =>
        new DocumentService().update(a.context, document.id, {
          title: document.title,
          projectId: beta.id,
          metadataRevision: document.metadataRevision,
        }),
      /uses files from its current project/
    )
  })

  test('linking a file used outside the project is refused; unlinking the last project frees it', async ({
    assert,
  }) => {
    const a = await account()
    const alpha = await project(a, 'Alpha')
    const beta = await project(a, 'Beta')
    const file = await source(a, false)
    await caseStudy(a, beta.id, [file.file.id])
    const service = new ProjectFilesService()
    await assert.rejects(() => service.attach(a.context, file.file.id, alpha.id), /Scoped/)
    // Linking to the project that uses it, then to another, keeps the case study valid.
    assert.isTrue(await service.attach(a.context, file.file.id, beta.id))
    assert.isTrue(await service.attach(a.context, file.file.id, alpha.id))
    assert.isFalse(await service.attach(a.context, file.file.id, alpha.id))
    await assert.rejects(() => service.detach(a.context, file.file.id, beta.id), /Scoped/)
    assert.isTrue(await service.detach(a.context, file.file.id, alpha.id))
    assert.isTrue(await service.detach(a.context, file.file.id, beta.id))
    assert.lengthOf(await db.from('project_files').where({ file_id: file.file.id }), 0)
  })

  test('the database rejects a source that breaks the project rule', async ({ assert }) => {
    const a = await account()
    const alpha = await project(a, 'Alpha')
    const file = await source(a, false)
    await link(a, file.file.id, alpha.id)
    await assert.rejects(() =>
      db.table('document_files').insert({
        workspace_id: a.workspace.id,
        document_id: a.document.id,
        files_id: file.file.id,
      })
    )
    const used = await source(a)
    await assert.rejects(() => link(a, used.file.id, alpha.id))
  })

  test('routes link and unlink files for the owner only', async ({ client, assert }) => {
    const a = await account()
    const b = await account('member@example.test')
    await WorkspaceMembership.create({
      workspaceId: a.workspace.id,
      userId: b.user.id,
      role: 'member',
      authorizationEpoch: 0,
    })
    const alpha = await project(a, 'Alpha')
    const file = await source(a, false)
    const url = `/workspaces/${a.workspace.id}/files/${file.file.id}/projects`
    const denied = await client
      .post(url)
      .json({ projectId: alpha.id })
      .loginAs(b.user)
      .withCsrfToken()
      .header('accept', 'application/json')
    denied.assertStatus(403)
    assert.lengthOf(await db.from('project_files').where({ file_id: file.file.id }), 0)
    const linked = await client
      .post(url)
      .json({ projectId: alpha.id })
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
    linked.assertStatus(200)
    assert.lengthOf(await db.from('project_files').where({ file_id: file.file.id }), 1)
    const unlinked = await client
      .delete(`${url}/${alpha.id}`)
      .loginAs(a.user)
      .withCsrfToken()
      .header('accept', 'application/json')
    unlinked.assertStatus(200)
    assert.lengthOf(await db.from('project_files').where({ file_id: file.file.id }), 0)
  })

  test('case study editor only offers eligible sources', async ({ client, assert }) => {
    const a = await account()
    const alpha = await project(a, 'Alpha')
    const beta = await project(a, 'Beta')
    const shared = await source(a, false)
    const alphaFile = await source(a, false)
    const betaFile = await source(a, false)
    await link(a, alphaFile.file.id, alpha.id)
    await link(a, betaFile.file.id, beta.id)
    const document = await caseStudy(a, alpha.id)
    const page = await client
      .get(`/workspaces/${a.workspace.id}/documents/${document.id}/edit`)
      .loginAs(a.user)
      .header('x-inertia', 'true')
      .header('x-inertia-version', 'tenancy-test')
    page.assertStatus(200)
    const offered = page.body().props.availableFiles.map((file: { id: string }) => file.id)
    assert.sameMembers(offered, [shared.file.id, alphaFile.file.id])
  })

  test('files:project-link dry-runs, applies and skips conflicts', async ({ assert }) => {
    const a = await account()
    const alpha = await project(a, 'Alpha')
    const free = await source(a, false)
    const used = await source(a)
    const args = [
      `--workspace=${a.workspace.id}`,
      `--project=${alpha.id}`,
      `--files=${free.file.id},${used.file.id}`,
    ]
    const dry = await ace.create(LinkProjectFiles, [...args, '--dry-run'])
    await dry.exec()
    assert.lengthOf(await db.from('project_files'), 0)
    const apply = await ace.create(LinkProjectFiles, [...args, '--apply'])
    await apply.exec()
    assert.equal(apply.exitCode, 1)
    const links = await db.from('project_files')
    assert.deepEqual(
      links.map((row) => row.file_id),
      [free.file.id]
    )
  })

  test('files:verify-project-scope reports violations', async ({ assert }) => {
    const a = await account()
    const alpha = await project(a, 'Alpha')
    const used = await source(a)
    const clean = await ace.create(VerifyProjectFiles, [])
    await clean.exec()
    assert.notEqual(clean.exitCode, 1)
    // Bypass the trigger to simulate data written before it existed.
    await db.transaction(async (trx) => {
      await trx.rawQuery('ALTER TABLE project_files DISABLE TRIGGER project_files_project_scope')
      await trx
        .table('project_files')
        .insert({ workspace_id: a.workspace.id, project_id: alpha.id, file_id: used.file.id })
      await trx.rawQuery('ALTER TABLE project_files ENABLE TRIGGER project_files_project_scope')
    })
    const dirty = await ace.create(VerifyProjectFiles, [`--workspace=${a.workspace.id}`])
    await dirty.exec()
    assert.equal(dirty.exitCode, 1)
  })
})
