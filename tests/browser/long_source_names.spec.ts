import { test } from '@japa/runner'
import { mkdir } from 'node:fs/promises'
import File from '#models/file'
import { account, reset, source } from '../helpers/workspaces.ts'

const LONG =
  'Quarterly_Warehouse_Modernisation_Report_Final_Version_2026_Leeds_Bristol_Glasgow_Cardiff.pdf'
const SHORT = 'notes.txt'

const isTruncated = (selector: string) =>
  `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && el.scrollWidth > el.clientWidth })()`
// True when the element under `scope` whose text is exactly `text` is cut off with an ellipsis.
const nameIsCut = (scope: string, text: string) =>
  `(() => { const el = [...document.querySelectorAll(${JSON.stringify(`${scope} [data-slot=tooltip-trigger]`)})].find((item) => item.textContent === ${JSON.stringify(text)}); return !!el && el.scrollWidth > el.clientWidth })()`

test.group('Long source names', (group) => {
  group.each.setup(() => reset())
  test('long names end in an ellipsis, never widen the picker, and show in full on hover', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account()
    const long = await source(a)
    await File.query().where('id', long.file.id).update({ filename: LONG })
    const short = await source(a)
    await File.query().where('id', short.file.id).update({ filename: SHORT })
    await browserContext.loginAs(a.user)

    for (const width of [1440, 390]) {
      const page = await visit(`/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`)
      await page.setViewportSize({ width, height: 900 })
      await page.getByRole('button', { name: 'Generate', exact: true }).waitFor() // rendered
      const details = page.locator('#document-details')
      // Below the xl breakpoint the details panel opens from its toolbar button.
      if (!(await details.isVisible()))
        await page.getByRole('button', { name: 'Details', exact: true }).click()
      await details.getByText('Sources', { exact: true }).click()
      const panelName = details.getByText(LONG, { exact: true })
      await panelName.waitFor()
      assert.isTrue(await page.evaluate<boolean>(nameIsCut('#document-details', LONG)))

      // Hovering a cut-off name shows the full name; a name that fits shows nothing.
      await panelName.hover()
      const tooltip = page.locator('[data-slot="tooltip-content"]')
      await tooltip.waitFor()
      assert.equal(await tooltip.innerText(), LONG)
      if (process.env.UI_SCREENSHOT_DIR) {
        await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true })
        await page.screenshot({
          path: `${process.env.UI_SCREENSHOT_DIR}/source-name-tooltip-${width}.png`,
        })
      }
      await page.mouse.move(0, 0, { steps: 12 }) // a real pointer path, not a teleport
      await tooltip.waitFor({ state: 'detached' })
      await details.getByText(SHORT, { exact: true }).hover()
      await page.waitForTimeout(600)
      assert.equal(await tooltip.count(), 0, 'a name that fits must not open a tooltip')

      await details.getByRole('button', { name: /\d+ sources/ }).click()
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      await dialog.getByText(LONG, { exact: true }).waitFor()
      await dialog.getByRole('tab', { name: 'Upload' }).click()
      await dialog.locator('input[type=file]').setInputFiles({
        name: LONG.replace('.pdf', '_upload.pdf'),
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4'),
      })
      const staged = dialog.getByText(LONG.replace('.pdf', '_upload.pdf'), { exact: true })
      await staged.waitFor()
      assert.isTrue(
        await page.evaluate<boolean>(
          nameIsCut('[role=dialog]', LONG.replace('.pdf', '_upload.pdf'))
        )
      )
      assert.isTrue(
        await page.evaluate<boolean>(
          '(() => { const el = document.querySelector("[role=dialog]"); return el.scrollWidth <= el.clientWidth })()'
        ),
        `dialog content overflows at ${width}px`
      )
      assert.isTrue(
        await page.evaluate<boolean>('document.documentElement.scrollWidth <= innerWidth')
      )
      assert.isFalse(await page.evaluate<boolean>(isTruncated('[role=dialog] button[type=submit]')))
      if (process.env.UI_SCREENSHOT_DIR)
        await page.screenshot({
          path: `${process.env.UI_SCREENSHOT_DIR}/source-picker-upload-${width}.png`,
        })
    }
  })
})
