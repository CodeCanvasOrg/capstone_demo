import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import { randomUUID } from 'node:crypto'
import env from '#start/env'
import Document from '#models/document'
import DocumentCanvasDraft from '#models/document_canvas_draft'
import VersionService from '#services/documents/version_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import { documentFromPages } from '../../shared/brochure/content.ts'
import type { DesignId } from '../../shared/brochure/designs.ts'
import { DEFAULT_TEMPLATE_ID } from '../../shared/layout/templates.ts'
import { samples } from '../fixtures/brochure/pages.ts'
import { png } from '../fixtures/document_image.ts'
import { account, reset } from '../helpers/workspaces.ts'

type Account = Awaited<ReturnType<typeof account>>
const DESIGNS: DesignId[] = ['cover', 'article']

async function canvasDocument(a: Account) {
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

test.group('Canvas editor: images and deletions', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
    env.set('CANVAS_EDITOR', 'pilot')
  })
  group.each.teardown(() => {
    drive.restore()
    env.set('CANVAS_EDITOR', undefined as never)
  })

  test('add a picture, set its focal point, preview it, delete it and preview again', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('canvas-images@example.test')
    await canvasDocument(a)
    await browserContext.loginAs(a.user)
    const base = `/workspaces/${a.workspace.id}/documents/${a.document.id}`
    const page = await visit(`${base}/edit`)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page
      .getByRole('radiogroup', { name: 'Editor' })
      .getByRole('radio', { name: 'Canvas' })
      .click()
    await page.waitForURL(/\/canvas$/)
    const frame = page.frameLocator('iframe.gjs-frame')
    await frame.locator('.cv-sheet').first().waitFor()

    // Place an empty image box on page 2: it autosaves (it used to fail on its empty alt).
    await page.getByRole('button', { name: 'Image', exact: true }).click()
    await frame.locator('#s1').scrollIntoViewIfNeeded()
    const sheet = (await frame.locator('#s1').boundingBox())!
    // The middle of the visible part of the page, clear of the header.
    const viewport = page.viewportSize()!
    const y = Math.min(sheet.y + sheet.height / 2, (sheet.y + viewport.height) / 2 + 40)
    await page.mouse.click(sheet.x + sheet.width * 0.5, y)
    await frame.locator('#s1 .cv-image-empty').waitFor()
    await page.getByText('All changes saved').waitFor({ timeout: 10_000 })

    // Upload from the inspector: the library shows it, the box shows it.
    await page.getByTestId('canvas-image-input').setInputFiles({
      name: 'hero.png',
      mimeType: 'image/png',
      buffer: png(60, 30),
    })
    await page.getByRole('list', { name: 'Document images' }).getByRole('button').waitFor()
    await frame.locator('#s1 .cv-image img').waitFor()
    assert.equal(await page.getByLabel('Description (alt text)').inputValue(), 'hero')

    // Fit the box to the picture (2:1), then move the focal point with the keyboard.
    await page.getByRole('button', { name: 'Fit box to picture' }).click()
    const w = Number(await page.getByLabel('Width (mm)', { exact: true }).inputValue())
    const h = Number(await page.getByLabel('Height (mm)', { exact: true }).inputValue())
    assert.closeTo(w / h, 2, 0.05)
    const focal = page.getByRole('slider', { name: 'Focal point' })
    await focal.focus()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowUp')
    await page.getByText('All changes saved').waitFor({ timeout: 10_000 })
    const draft = await DocumentCanvasDraft.findOrFail(a.document.id)
    const image = draft.project.sheets[1].frames.find((f) => f.kind === 'image')!
    assert.deepEqual(image.kind === 'image' && image.focus, { x: 45, y: 45 })

    // The preview prints it, embedded, without a Save version.
    const preview = async () => (await page.request.get(`${base}/preview`)).text()
    const withImage = await preview()
    assert.include(withImage, `id="${image.id}"><img src="data:image/png;base64,`)
    assert.include(withImage, 'object-position:45% 45%')

    // Delete it and preview at once: the pending change is saved first.
    await frame.locator(`#${image.id}`).click()
    await page
      .getByRole('toolbar', { name: 'Canvas tools' })
      .getByRole('button', { name: 'Delete', exact: true })
      .click()
    await frame.locator(`#${image.id}`).waitFor({ state: 'detached' })
    const popup = page.waitForEvent('popup')
    await page.getByRole('link', { name: 'Preview' }).click()
    const tab = await popup
    await tab.waitForURL(/\/preview$/)
    assert.notInclude(await tab.content(), `id="${image.id}"`)
    assert.notInclude(await preview(), `id="${image.id}"`)

    assert.deepEqual(errors, [])
  })
})
