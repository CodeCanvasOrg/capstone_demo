import { test } from '@japa/runner'
import { mkdir } from 'node:fs/promises'
import db from '@adonisjs/lucid/services/db'
import File from '#models/file'
import DocumentService from '#services/documents/document_service'
import ProjectService from '#services/workspaces/project_service'
import { account, reset, source } from '../helpers/workspaces.ts'

test.group('Project files', (group) => {
  group.each.setup(() => reset())
  test('files are linked on the project page and only offered to that project', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account()
    const alpha = await new ProjectService().save(a.context, { name: 'Alpha' })
    const beta = await new ProjectService().save(a.context, { name: 'Beta' })
    const brief = await source(a, false)
    await File.query().where('id', brief.file.id).update({ filename: 'alpha-brief.txt' })
    const other = await source(a, false)
    await File.query().where('id', other.file.id).update({ filename: 'beta-notes.txt' })
    await db
      .table('project_files')
      .insert({ workspace_id: a.workspace.id, project_id: beta.id, file_id: other.file.id })
    const shared = await source(a, false)
    await File.query().where('id', shared.file.id).update({ filename: 'shared-guide.txt' })
    await browserContext.loginAs(a.user)

    // Link an existing file from the project page.
    const page = await visit(`/workspaces/${a.workspace.id}/projects/${alpha.id}`)
    await page.getByRole('button', { name: 'Add existing' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('File').selectOption({ label: 'alpha-brief.txt' })
    await dialog.getByRole('button', { name: 'Add' }).click()
    const files = page.locator('section[aria-labelledby="project-files-heading"]')
    await files.getByText('alpha-brief.txt', { exact: true }).waitFor()
    await dialog.waitFor({ state: 'detached' })
    if (process.env.UI_SCREENSHOT_DIR) {
      await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true })
      await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/project-files.png` })
    }

    // A case study in Alpha sees Alpha's file and workspace files, never Beta's.
    const document = await new DocumentService().create(
      a.context,
      { title: 'Alpha study', projectId: alpha.id, sourceMode: 'input_only' },
      []
    )
    const editor = await visit(`/workspaces/${a.workspace.id}/documents/${document.id}/edit`)
    await editor.getByRole('button', { name: 'Generate', exact: true }).waitFor()
    const details = editor.locator('#document-details')
    if (!(await details.isVisible()))
      await editor.getByRole('button', { name: 'Details', exact: true }).click()
    await details.getByText('Sources', { exact: true }).first().click()
    await details.locator('[data-slot=dialog-trigger]', { hasText: 'Sources' }).click()
    const picker = editor.getByRole('dialog')
    const projectGroup = picker.getByRole('region', { name: 'This project' })
    await projectGroup.getByText('alpha-brief.txt', { exact: true }).waitFor()
    await picker
      .getByRole('region', { name: 'Workspace library' })
      .getByText('shared-guide.txt', { exact: true })
      .waitFor()
    assert.equal(await picker.getByText('beta-notes.txt', { exact: true }).count(), 0)
    await editor.keyboard.press('Escape')

    // Removing the only project link returns the file to the workspace library.
    await page.reload()
    await files.getByRole('button', { name: 'Remove from project' }).click()
    await files.getByText('No project files yet.', { exact: false }).waitFor()
    assert.lengthOf(await db.from('project_files').where({ file_id: brief.file.id }), 0)
  })
})
