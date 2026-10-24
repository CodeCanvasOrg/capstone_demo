import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import WorkspaceMembership from '#models/workspace_membership'
import VersionService from '#services/documents/version_service'
import { account, reset } from '../helpers/workspaces.ts'

const screenshots = process.env.UI_SCREENSHOT_DIR

test.group('UI simplicity', (group) => {
  group.each.setup(() => reset())
  test('team checklist stays visible at mobile and desktop widths with heading-only rows', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('ui-checklist@example.test')
    const member = await account('ui-checklist-member@example.test')
    await WorkspaceMembership.create({
      workspaceId: fixture.workspace.id,
      userId: member.user.id,
      role: 'member',
      authorizationEpoch: 0,
    })
    await browserContext.loginAs(fixture.user)
    const page = await visit(
      `/workspaces/${fixture.workspace.id}/documents/${fixture.document.id}/edit`
    )
    const checklist = page.getByRole('region', { name: 'Review checklist' })
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.isTrue(await checklist.isVisible())
      assert.equal(await checklist.getByRole('heading', { level: 3 }).count(), 4)
      assert.equal(await checklist.locator('p').count(), 0)
      assert.equal(await checklist.getByRole('progressbar').count(), 0)
      assert.equal(await page.getByRole('button', { name: 'Details', exact: true }).count(), 0)
    }
  })
  test('metadata failures stay inside the dialog and optional fields reveal their errors', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('ui-dialog@example.test')
    await browserContext.loginAs(fixture.user)
    const page = await visit(
      `/workspaces/${fixture.workspace.id}/documents/${fixture.document.id}/edit`
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.getByRole('button', { name: 'More', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Information' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Case-study title').fill('Preserve this title')
    await page.route(`**/documents/${fixture.document.id}`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 422,
            json: { errors: [{ field: 'dueDate', message: 'Invalid calendar deadline' }] },
          })
        : route.continue()
    )
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await dialog.getByText('Choose a valid deadline.').waitFor()
    assert.equal(await dialog.getByLabel('Case-study title').inputValue(), 'Preserve this title')
    await dialog.getByLabel('Deadline').waitFor({ state: 'visible' })
    assert.equal(await dialog.getByLabel('Deadline').getAttribute('aria-invalid'), 'true')
    assert.equal(await page.locator('[data-sonner-toast]').count(), 0)
    assert.deepEqual(errors, [])
  })
  test('one inspector preserves issue drafts across mobile toggling and resize', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('ui-inspector@example.test')
    await browserContext.loginAs(fixture.user)
    const page = await visit(
      `/workspaces/${fixture.workspace.id}/documents/${fixture.document.id}/edit`
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Details', exact: true }).click()
    await page.locator('summary').filter({ hasText: 'Issues' }).click()
    await page.getByRole('button', { name: 'Add issue' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Issue title').fill('Keep this feedback')
    await page.setViewportSize({ width: 1440, height: 1000 })
    assert.equal(await dialog.getByLabel('Issue title').inputValue(), 'Keep this feedback')
    assert.equal(await page.locator('#document-details').count(), 1)
    await page.route('**/issues', (route) =>
      route.fulfill({
        status: 422,
        json: { errors: [{ field: 'title', message: 'The title field is required' }] },
      })
    )
    await dialog.getByRole('button', { name: 'Add issue', exact: true }).click()
    await dialog.getByText('This field is required.').waitFor()
    assert.equal(await dialog.getByLabel('Issue title').inputValue(), 'Keep this feedback')
    page.on('dialog', (native) => native.accept())
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Details', exact: true }).click()
    await page.getByRole('button', { name: 'Details', exact: true }).click()
    assert.isTrue(await page.getByRole('button', { name: 'Add issue' }).isVisible())
    assert.isTrue(
      await page.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth')
    )
  })
  test('save conflicts retain the local draft and its download recovery', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('ui-save@example.test')
    await new VersionService().save(fixture.context, fixture.document.id, {
      baseVersionId: null,
      mutationId: randomUUID(),
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original draft' }] }],
      },
    })
    await browserContext.loginAs(fixture.user)
    const page = await visit(
      `/workspaces/${fixture.workspace.id}/documents/${fixture.document.id}/edit`
    )
    await page.route('**/versions', (route) =>
      route.fulfill({
        status: 409,
        json: {
          error: {
            message:
              'A newer version exists. Keep your local content and compare it before saving again.',
          },
        },
      })
    )
    const editor = page.getByRole('textbox', { name: 'Case-study content' })
    await editor.fill('My local work must survive')
    await page.getByRole('button', { name: 'Load latest version' }).waitFor()
    assert.include(await editor.innerText(), 'My local work must survive')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download local draft' }).click()
    const downloaded = await download
    assert.equal(downloaded.suggestedFilename(), 'case-study-local-draft.json')
    assert.include(await editor.innerText(), 'My local work must survive')
  })
  test('failed uploads persist per file and can recover without losing successful receipts', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('ui-upload@example.test')
    await browserContext.loginAs(fixture.user)
    const page = await visit(`/workspaces/${fixture.workspace.id}/files/create`)
    let attempts = 0
    await page.route('**/files/uploads', (route) => {
      attempts++
      return attempts === 1
        ? route.fulfill({ status: 503, json: { error: { message: 'internal storage secret' } } })
        : route.fulfill({
            json: { id: randomUUID(), filename: 'notes.txt', filetype: '.txt', downloadUrl: null },
          })
    })
    await page.locator('input[type=file]').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Project evidence'),
    })
    await page.getByRole('button', { name: 'Upload 1 file', exact: true }).click()
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor()
    assert.notInclude(await page.locator('body').innerText(), 'internal storage secret')
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await page.getByRole('button', { name: 'Remove notes.txt from list' }).waitFor()
    assert.equal(attempts, 2)
    assert.equal(await page.getByRole('button', { name: 'Retry', exact: true }).count(), 0)
  })
  test('desktop and mobile render in both themes with reduced motion and usable menus', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('ui-visual@example.test')
    await new VersionService().save(fixture.context, fixture.document.id, {
      baseVersionId: null,
      mutationId: randomUUID(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'A simpler way to tell the story of our work.' }],
          },
        ],
      },
    })
    await browserContext.loginAs(fixture.user)
    const page = await visit(
      `/workspaces/${fixture.workspace.id}/documents/${fixture.document.id}/edit`
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const theme of ['light', 'dark']) {
        await page.evaluate(
          'document.documentElement.classList.toggle("dark", ' + (theme === 'dark') + ')'
        )
        await page.getByRole('button', { name: 'More', exact: true }).focus()
        await page.keyboard.press('Enter')
        await page.getByRole('menuitem', { name: 'History', exact: true }).waitFor()
        await page.keyboard.press('Escape')
        assert.equal(
          await page.evaluate<boolean>('document.activeElement?.textContent?.trim() === "More"'),
          true
        )
        assert.isTrue(
          await page.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth')
        )
        if (screenshots) {
          await mkdir(screenshots, { recursive: true })
          await page.screenshot({
            path: `${screenshots}/editor-${width}-${theme}.png`,
            fullPage: true,
          })
        }
      }
    }
    assert.deepEqual(errors, [])
  })
})
