import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import { randomUUID } from 'node:crypto'
import env from '#start/env'
import Document from '#models/document'
import DocumentCanvas from '#models/document_canvas'
import DocumentCanvasDraft from '#models/document_canvas_draft'
import DocumentVersion from '#models/document_version'
import VersionService from '#services/documents/version_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import { documentFromPages } from '../../shared/brochure/content.ts'
import type { DesignId } from '../../shared/brochure/designs.ts'
import { DEFAULT_TEMPLATE_ID } from '../../shared/layout/templates.ts'
import { samples } from '../fixtures/brochure/pages.ts'
import { account, reset } from '../helpers/workspaces.ts'

type Account = Awaited<ReturnType<typeof account>>
const DESIGNS: DesignId[] = ['cover', 'article', 'contact']

async function brochure(a: Account) {
  const doc = await Document.findOrFail(a.document.id)
  await new VersionService().save(a.context, a.document.id, {
    content: documentFromPages(DESIGNS.map((d) => samples[d])).document,
    baseVersionId: doc.currentVersionId,
    mutationId: randomUUID(),
  })
  await new LayoutSelectionService().save(a.context, a.document.id, {
    templateId: DEFAULT_TEMPLATE_ID,
    options: { brochure: { source: 'custom', pages: DESIGNS } },
    baseRevision: 0,
  })
}

const canvasUrl = (a: Account) => `/workspaces/${a.workspace.id}/documents/${a.document.id}/canvas`

test.group('Canvas editor', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
    env.set('CANVAS_EDITOR', 'pilot')
  })
  group.each.teardown(() => {
    drive.restore()
    env.set('CANVAS_EDITOR', undefined as never)
  })

  test('lay out a brochure: open, move, edit text, add a page and save a version', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('canvas-editor@example.test')
    await brochure(a)
    await browserContext.loginAs(a.user)
    const page = await visit(`/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    // From the case study, switch the editor to Canvas: its pages are laid out by their designs.
    await page
      .getByRole('radiogroup', { name: 'Editor' })
      .getByRole('radio', { name: 'Canvas' })
      .click()
    await page.waitForURL(/\/canvas$/)
    const frame = page.frameLocator('iframe.gjs-frame')
    await frame.locator('.cv-sheet').first().waitFor()
    assert.equal(await frame.locator('.cv-sheet').count(), DESIGNS.length)
    if (process.env.UI_SCREENSHOT_DIR) {
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/canvas-open.png` })
      await frame.locator('#s1').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/canvas-page2.png` })
    }
    assert.equal(
      await page.getByRole('navigation', { name: 'Pages' }).getByRole('listitem').count(),
      3
    )

    // Select the article's body text (page 2) and move it with the inspector.
    const body = frame.locator('#s1-f2')
    await body.scrollIntoViewIfNeeded()
    await body.click()
    const x = page.getByLabel('X (mm)')
    await x.waitFor()
    await x.fill('30')
    const left = Number.parseFloat(await body.evaluate((el) => getComputedStyle(el).left))
    assert.closeTo(left, (30 * 96) / 25.4, 0.01)

    // Autosave: the draft holds the new position.
    await page.getByText('All changes saved').waitFor({ timeout: 10_000 })
    const draft = await DocumentCanvasDraft.findOrFail(a.document.id)
    const moved = draft.project.sheets[1].frames.find((f) => f.id === 's1-f2')!
    assert.equal(moved.geo.x, 300)

    // Drag it with the mouse: GrapesJS writes px, the editor stores mm.
    const box = (await body.boundingBox())!
    // Press in the middle: the top of the box may sit under the page header.
    const midY = box.y + box.height / 2
    await page.mouse.move(box.x + 20, midY)
    await page.mouse.down()
    await page.mouse.move(box.x + 60, midY, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    // 40 screen px at the fitted zoom, in mm (snapping may shift it by up to 1.5 mm).
    const zoom = Number.parseInt(await page.getByText(/^\d+%$/).innerText(), 10) / 100
    const expected = 30 + ((40 / zoom) * 25.4) / 96
    assert.closeTo(Number(await x.inputValue()), expected, 2)

    // Double-click to edit its text in place; Esc ends editing.
    await body.dblclick()
    await frame.locator('#s1-f2 .ProseMirror').waitFor()
    await page.getByRole('toolbar', { name: 'Text formatting' }).waitFor()
    await page.keyboard.press('End')
    await page.keyboard.type(' Laid out in the canvas.')
    await page.keyboard.press('Escape')
    await frame.locator('#s1-f2 .ProseMirror').waitFor({ state: 'detached' })
    assert.include(await body.innerText(), 'Laid out in the canvas.')

    // Add a page after the selected one.
    await page.getByRole('button', { name: 'Add page' }).click()
    await page.waitForFunction(
      () => document.querySelector('iframe.gjs-frame') !== null,
      undefined,
      { timeout: 5000 }
    )
    assert.equal(await frame.locator('.cv-sheet').count(), DESIGNS.length + 1)

    if (process.env.UI_SCREENSHOT_DIR)
      await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/canvas-editor.png` })

    // Save a version: the canvas and its text are stored together.
    await page.getByRole('button', { name: 'Save version' }).click()
    await page.getByText(/Saved as version \d+/).waitFor({ timeout: 10_000 })
    const doc = await Document.findOrFail(a.document.id)
    const canvas = await DocumentCanvas.findByOrFail('versionId', doc.currentVersionId!)
    assert.equal(canvas.source, 'edited')
    assert.equal(canvas.sheetCount, DESIGNS.length + 1)
    const version = await DocumentVersion.findOrFail(doc.currentVersionId!)
    assert.include(JSON.stringify(version.content), 'Laid out in the canvas.')
    assert.isNull(await DocumentCanvasDraft.find(a.document.id))

    assert.deepEqual(errors, [])
  })

  test('a new case study switches to the canvas and back to text', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('canvas-new@example.test')
    await browserContext.loginAs(a.user)
    const editUrl = `/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`
    const page = await visit(editUrl)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const editor = page.getByRole('radiogroup', { name: 'Editor' })

    await editor.getByRole('radio', { name: 'Canvas' }).click()
    await page.waitForURL(/\/canvas$/)
    const frame = page.frameLocator('iframe.gjs-frame')
    await frame.locator('.cv-sheet').first().waitFor()
    assert.equal(await frame.locator('.cv-sheet').count(), 2)
    assert.include(await frame.locator('#s0').innerText(), 'Evidence example')
    if (process.env.UI_SCREENSHOT_DIR) {
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/canvas-new.png` })
    }

    // The case study page now points to the canvas instead of the text editor.
    await page.getByRole('link', { name: 'Case study', exact: true }).click()
    await page.getByText('This case study is laid out in the canvas').waitFor()
    assert.equal(
      await editor.getByRole('radio', { name: 'Canvas' }).getAttribute('aria-checked'),
      'false'
    )
    if (process.env.UI_SCREENSHOT_DIR)
      await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/case-study-canvas-mode.png` })

    // Back to text: confirm, and the text editor returns.
    await page.getByRole('link', { name: 'Open the canvas' }).click()
    await page.waitForURL(/\/canvas$/)
    await editor.getByRole('radio', { name: 'Text' }).click()
    await page.getByRole('button', { name: 'Go back' }).click()
    await page.waitForURL(/\/edit$/)
    await page.getByText('This case study is laid out in the canvas').waitFor({ state: 'detached' })
    assert.deepEqual(errors, [])
  })

  test('the document page offers the canvas only when the pilot is on', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('canvas-entry@example.test')
    await brochure(a)
    await browserContext.loginAs(a.user)
    const page = await visit(`/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`)
    const editor = page.getByRole('radiogroup', { name: 'Editor' })
    await editor.waitFor()
    env.set('CANVAS_EDITOR', undefined as never)
    await page.reload()
    await page.getByRole('heading', { name: 'Evidence example' }).waitFor()
    assert.equal(await editor.count(), 0)
  })
})
