import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import PublicationContentService from '#services/documents/publication_content_service'
import BrandedEntryService from '#services/documents/branded_entry_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import VersionService from '#services/documents/version_service'
import { entrySchema, entryToDocument } from '../../shared/layout/entry.ts'
import type { PublicationDocument } from '../../shared/publication/content.ts'
import { account, reset } from '../helpers/workspaces.ts'
import { brandedEntry } from '../fixtures/layout/branded_entry.ts'

/** The document a branded generation produces, with its publication metadata. */
function generated(extraParagraphs = 0) {
  const { document, sidecar } = entryToDocument(entrySchema.parse(brandedEntry), {
    allowedChunkIds: new Set(),
  })
  for (let i = 0; i < extraParagraphs; i++)
    document.content.push({
      type: 'paragraph',
      content: [
        { type: 'text', text: `Extra paragraph ${i}. ${'More supporting detail. '.repeat(30)}` },
      ],
    })
  const service = new PublicationContentService()
  const { document: mapped } = service.mapLegacy(document as PublicationDocument, 'browser-test')
  new BrandedEntryService().apply(service, mapped, sidecar, 'browser-test')
  return service.accept(mapped, { resolvers: service.resolversFor(mapped) })
}

async function open(a: Awaited<ReturnType<typeof account>>, extra = 0) {
  await new VersionService().save(a.context, a.document.id, {
    content: generated(extra),
    baseVersionId: null,
    mutationId: randomUUID(),
  })
}
const url = (a: Awaited<ReturnType<typeof account>>) =>
  `/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`

test.group('Branded editor page view', (group) => {
  group.each.setup(() => reset())

  test('a generated entry renders in the branded format with evidence badges', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-editor@example.test')
    await open(a)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.locator('h1.pm-hero').waitFor()
    assert.include(await page.locator('h1.pm-hero').innerText(), brandedEntry.hero.headline)
    assert.equal(await page.locator('.pm-results .stat-figure').count(), 3)
    const badges: string[] = []
    const badgeCount = await page.locator('.evidence-badge').count()
    for (let i = 0; i < badgeCount; i++)
      badges.push((await page.locator('.evidence-badge').nth(i).getAttribute('data-label')) ?? '')
    assert.deepEqual(
      badges.map((text) => text.toLowerCase()),
      ['estimated', 'client reported', 'design target']
    )
    assert.equal(await page.locator('ol.pm-steps > li').count(), 4)
    assert.equal(await page.locator('ul.pm-capabilities > li').count(), 3)
    // Pages: one short entry is one page, inside the standard 2-page budget.
    await page.locator('.page-end').waitFor()
    assert.match((await page.locator('.page-end').getAttribute('data-label')) ?? '', /1 page/i)
    if (process.env.UI_SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.UI_SCREENSHOT_DIR}/branded-editor.png`,
        fullPage: true,
      })
    assert.deepEqual(errors, [])
  })

  test('content beyond the budget is split into pages and flagged, not hidden', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-pages@example.test')
    await open(a, 6)
    await new LayoutSelectionService().save(a.context, a.document.id, {
      templateId: 'case_study_concise',
      baseRevision: 0,
    })
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    await page.locator('.page-gap').first().waitFor()
    assert.isAbove(await page.locator('.page-gap').count(), 0)
    // Budget is 1 page, so the second page is marked over budget.
    await page.locator('.page-gap.over').first().waitFor()
    if (process.env.UI_SCREENSHOT_DIR)
      await page.screenshot({
        path: `${process.env.UI_SCREENSHOT_DIR}/branded-pages.png`,
        fullPage: true,
      })
    assert.match(
      (await page.locator('.page-gap.over').first().getAttribute('data-label')) ?? '',
      /over the 1-page budget/i
    )
    await page.locator('.page-end.over').waitFor()
    // Every block is still present in the editor.
    assert.equal(await page.locator('.ProseMirror p', { hasText: 'Extra paragraph 5' }).count(), 1)
  })

  test('the branded content stays editable and saves a new version', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-edit@example.test')
    await open(a)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    const challenge = page.locator('.ProseMirror p', { hasText: 'Customs staff retyped' })
    await challenge.waitFor()
    await challenge.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Edited by a person.')
    await page.waitForResponse(
      (r) => r.url().endsWith('/versions') && r.request().method() === 'POST' && r.ok()
    )
    await a.document.refresh()
    const versions = await a.document.related('documentVersions').query().orderBy('version', 'desc')
    assert.include(JSON.stringify(versions[0].content), 'Edited by a person.')
    // The headline and results survive the edit.
    assert.include(JSON.stringify(versions[0].content), brandedEntry.hero.headline)
  })

  test('challenge and solution sit side by side, like the PDF', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-columns@example.test')
    await open(a)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    const challenge = page.locator('h2.pm-challenge')
    const solution = page.locator('h2.pm-solution')
    await challenge.waitFor()
    const left = (await challenge.boundingBox())!
    const right = (await solution.boundingBox())!
    assert.approximately(left.y, right.y, 2)
    assert.isAbove(right.x, left.x + left.width / 2)
    // The paragraphs sit under their own headings, in the same two columns.
    const cp = (await page.locator('p.pm-challenge').boundingBox())!
    const sp = (await page.locator('p.pm-solution').boundingBox())!
    assert.approximately(cp.y, sp.y, 2)
    assert.isAbove(sp.x, cp.x + cp.width / 2)
  })

  test('the status bar shows the live page budget and switches layout', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-status@example.test')
    await open(a)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    const status = page.locator('.page-status')
    await status.getByText(/1 of 2 pages used/).waitFor()
    assert.match(await status.innerText(), /Last page \d+% full/)

    await status.getByLabel('Layout').selectOption('case_study_concise')
    await page.waitForResponse((r) => r.url().endsWith('/layout') && r.request().method() === 'PUT')
    await status.getByText(/of 1 page|over the 1-page limit/).waitFor()
    const selection = await new LayoutSelectionService().resolve(a.context, a.document.id)
    assert.equal(selection.templateId, 'case_study_concise')
  })

  test('over the limit: it says by how much, offers to shorten, and cuts nothing itself', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-over@example.test')
    await open(a, 6)
    await new LayoutSelectionService().save(a.context, a.document.id, {
      templateId: 'case_study_concise',
      baseRevision: 0,
    })
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    const alert = page.locator('.page-status').getByRole('alert')
    await alert.waitFor()
    assert.match(await alert.innerText(), /About \d+ lines too long/)
    assert.match(await alert.innerText(), /Final export is blocked/)
    await alert.getByRole('button', { name: 'Shorten to fit' }).click()
    const prompt = page.getByRole('textbox', { name: /change|ask/i }).last()
    await prompt.waitFor()
    const text = await prompt.inputValue()
    assert.include(text, 'Shorten this case study to fit 1 page')
    assert.include(text, 'evidence label')
    assert.include(text, 'every citation')
    // Opening the prompt changes nothing: all content is still in the editor.
    assert.equal(await page.locator('.ProseMirror p', { hasText: 'Extra paragraph 5' }).count(), 1)
  })
})
