import { test } from '@japa/runner'
import { mkdir } from 'node:fs/promises'
import drive from '@adonisjs/drive/services/main'
import DocumentImage from '#models/document_image'
import { account, reset } from '../helpers/workspaces.ts'
import { PNG } from '../fixtures/document_image.ts'

test.group('Document image upload UI', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => drive.restore())
  test('keyboard upload inserts, autosaves and reloads a real private image in both themes and mobile', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account()
    await browserContext.loginAs(a.user)
    const page = await visit(`/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const add = page.getByRole('button', { name: 'Add image', exact: true })
    await add.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await dialog
      .getByLabel('Image file')
      .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG })
    await dialog.getByLabel('Image description').fill('Our project diagram')
    const saved = page.waitForResponse(
      (response) => response.url().endsWith('/versions') && response.status() === 200
    )
    await dialog.getByRole('button', { name: 'Insert image', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await saved
    await page.reload()
    const image = page.getByRole('img', { name: 'Our project diagram' })
    await image.waitFor()
    await page.waitForFunction(`(() => {
      const img = document.querySelector('img[alt="Our project diagram"]')
      return !!img?.complete && img.naturalWidth > 0
    })()`)
    assert.lengthOf(await DocumentImage.all(), 1)
    for (const theme of ['light', 'dark']) {
      await page.evaluate(`document.documentElement.classList.toggle('dark', ${theme === 'dark'})`)
      await page.setViewportSize({ width: 390, height: 844 })
      assert.isTrue(await image.isVisible())
      assert.isTrue(
        await page.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth')
      )
      await add.click()
      await page.getByRole('dialog').waitFor()
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
    }
    if (process.env.UI_SCREENSHOT_DIR) {
      await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true })
      await page.screenshot({
        path: `${process.env.UI_SCREENSHOT_DIR}/document-image-mobile-dark.png`,
        fullPage: true,
      })
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.evaluate("document.documentElement.classList.remove('dark')")
      await page.screenshot({
        path: `${process.env.UI_SCREENSHOT_DIR}/document-image-desktop-light.png`,
        fullPage: true,
      })
    }
    assert.deepEqual(errors, [])
  })
  test('failed uploads retain file and description for retry; invalid files and cancellation create no nodes', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account()
    await browserContext.loginAs(a.user)
    const page = await visit(`/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`)
    await page.getByRole('button', { name: 'Add image', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Image file').setInputFiles({
      name: 'wrong.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg/>'),
    })
    await dialog.getByRole('button', { name: 'Insert image', exact: true }).click()
    await dialog.getByText('Choose a PNG or JPEG image up to 10 MB.', { exact: true }).waitFor()
    assert.lengthOf(await DocumentImage.all(), 0)
    await dialog
      .getByLabel('Image file')
      .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG })
    await dialog.getByLabel('Image description').fill('Keep this description')
    let attempts = 0
    await page.route('**/images', (route) => {
      attempts++
      return attempts === 1
        ? route.fulfill({ status: 503, json: { message: 'storage secret' } })
        : route.continue()
    })
    await dialog.getByRole('button', { name: 'Insert image', exact: true }).click()
    await dialog.getByText('This could not finish. Please try again.').waitFor()
    assert.equal(await dialog.getByLabel('Image description').inputValue(), 'Keep this description')
    assert.notInclude(await dialog.innerText(), 'storage secret')
    await dialog.getByRole('button', { name: 'Insert image', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('img', { name: 'Keep this description' }).waitFor()
    assert.equal(attempts, 2)
    assert.lengthOf(await DocumentImage.all(), 1)
    await page.getByRole('button', { name: 'Add image', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
    // The editor stays aria-hidden behind the modal until it finishes closing.
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal(await page.getByRole('img', { name: 'Keep this description' }).count(), 1)
  })
})
