/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import { randomUUID } from 'node:crypto'
import PublicationContentService from '#services/documents/publication_content_service'
import BrandedEntryService from '#services/documents/branded_entry_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import VersionService from '#services/documents/version_service'
import DocumentImageService from '#services/documents/document_image_service'
import { PNG } from '../fixtures/document_image.ts'
import { entrySchema, entryToDocument } from '../../shared/layout/entry.ts'
import type { PublicationDocument } from '../../shared/publication/content.ts'
import { account, reset } from '../helpers/workspaces.ts'
import { brandedEntry } from '../fixtures/layout/branded_entry.ts'

/** The document a branded generation produces, with its publication metadata. */
function generated(extraParagraphs = 0, imageId?: string) {
  const { document, sidecar } = entryToDocument(entrySchema.parse(brandedEntry), {
    allowedChunkIds: new Set(),
  })
  if (imageId)
    document.content.splice(2, 0, {
      type: 'image',
      attrs: { documentImageId: imageId, alt: 'A customs officer beside a document scanner' },
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

async function open(a: Awaited<ReturnType<typeof account>>, extra = 0, heroImage = false) {
  // Images must be stored and registered; the server drops any other.
  const image = heroImage
    ? await new DocumentImageService().upload(a.context, a.document.id, {
        filename: 'hero.png',
        contents: PNG,
      })
    : undefined
  await new VersionService().save(a.context, a.document.id, {
    content: generated(extra, image?.id),
    baseVersionId: null,
    mutationId: randomUUID(),
  })
}
const url = (a: Awaited<ReturnType<typeof account>>) =>
  `/workspaces/${a.workspace.id}/documents/${a.document.id}/edit`

test.group('Branded editor page view', (group) => {
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => drive.restore())

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
    assert.match(
      (await page.locator('.page-end').getAttribute('data-label')) ?? '',
      /\d pages? · budget 2/i
    )
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
    await status.getByText(/\d of 2 pages used/).waitFor()
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

  test('a hero image sits in the top-right corner of the hero, beside the title', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-hero-image@example.test')
    await open(a, 0, true)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    const image = page.locator('.pm-hero-image')
    await image.waitFor()
    if (process.env.UI_SCREENSHOT_DIR)
      await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/hero-image.png` })
    const sheet = (await page.locator('.ProseMirror').boundingBox())!
    const title = (await page.locator('h1.pm-hero').boundingBox())!
    const box = (await image.boundingBox())!
    const stats = (await page.locator('h2.pm-results').boundingBox())!
    // Right half of the sheet, level with the title, above the yellow band.
    assert.isAbove(box.x, sheet.x + sheet.width / 2)
    assert.isAtLeast(box.x + box.width, sheet.x + sheet.width * 0.8)
    assert.isBelow(box.y, title.y + title.height)
    assert.isBelow(box.y + box.height, stats.y)
    // The title leaves room for it instead of running underneath.
    const contentRight = await page
      .locator('p.pm-hero')
      .evaluate(
        (el: any) =>
          el.getBoundingClientRect().right -
          Number.parseFloat((globalThis as any).getComputedStyle(el).paddingRight)
      )
    assert.isBelow(contentRight, box.x)
  })

  test('the preview matches the PDF: bands edge to edge, white space below the blue part', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-frame@example.test')
    await open(a)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    await page.locator('h1.pm-hero').waitFor()
    const sheet = (await page.locator('.ProseMirror').boundingBox())!
    const hero = (await page.locator('h1.pm-hero').boundingBox())!
    const band = (await page.locator('h2.pm-results').boundingBox())!
    // The blue hero and yellow band reach both edges of the page.
    assert.approximately(hero.x, sheet.x, 1.5)
    assert.approximately(hero.x + hero.width, sheet.x + sheet.width, 1.5)
    assert.approximately(band.x, sheet.x, 1.5)
    // Text keeps the page margin (about 7.6% of the width).
    const text = (await page.locator('h2.pm-challenge').boundingBox())!
    assert.isAbove((text.x - sheet.x) / sheet.width, 0.065)
    // White space only below the blue part, before the yellow band.
    const heroLast = (await page.locator('p.pm-hero').boundingBox())!
    assert.isAtLeast(band.y - (heroLast.y + heroLast.height), 14)
    // And room between the band and the challenge/solution row, with a wide gutter.
    const lastResult = (await page.locator('p.pm-results').last().boundingBox())!
    assert.isAtLeast(text.y - (lastResult.y + lastResult.height), 20)
    const solution = (await page.locator('h2.pm-solution').boundingBox())!
    assert.isAtLeast(solution.x - (text.x + text.width), 24)
  })

  test('key results read as a tidy aligned list: figures share a width and the dash is hidden', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-stats@example.test')
    await open(a)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    const figures = page.locator('.pm-results .stat-figure')
    await figures.first().waitFor()
    const widths: number[] = []
    for (let i = 0; i < (await figures.count()); i++)
      widths.push((await figures.nth(i).boundingBox())!.width)
    assert.lengthOf(widths, 3)
    for (const width of widths) assert.approximately(width, widths[0], 1)
    // The "—" between figure and label is a spacing device in the text, not a visible mark.
    const dashes = page.locator('.stat-dash')
    assert.equal(await dashes.count(), 3)
    const display = await dashes
      .first()
      .evaluate((el: any) => (globalThis as any).getComputedStyle(el).display)
    assert.equal(display, 'none')
    // The text itself is unchanged, so copying or editing it still reads "90% — less time…".
    assert.include(await page.locator('p.pm-results').first().textContent(), '90% — less time')
  })

  test('the blue hero and yellow band are solid blocks: every row spans the full width, no gaps', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-solid@example.test')
    await open(a)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    await page.locator('h1.pm-hero').waitFor()
    const sheet = (await page.locator('.ProseMirror').boundingBox())!
    for (const selector of ['h1.pm-hero', 'p.pm-hero', 'h2.pm-results', 'p.pm-results']) {
      const count = await page.locator(selector).count()
      for (let i = 0; i < count; i++) {
        const box = (await page.locator(selector).nth(i).boundingBox())!
        assert.approximately(box.x, sheet.x, 1.5, selector)
        assert.approximately(box.x + box.width, sheet.x + sheet.width, 1.5, selector)
      }
    }
    // No white line between the band's label and its first row.
    const label = (await page.locator('h2.pm-results').boundingBox())!
    const first = (await page.locator('p.pm-results').first().boundingBox())!
    assert.approximately(first.y, label.y + label.height, 1)
  })

  test('details: visible caret on the navy hero, balanced headings, tabular figures', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-details@example.test')
    await open(a)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    await page.locator('h1.pm-hero').waitFor()
    const style = (selector: string, property: string) =>
      page
        .locator(selector)
        .first()
        .evaluate(
          (el: any, prop: string) =>
            (globalThis as any).getComputedStyle(el).getPropertyValue(prop),
          property
        )
    // A black caret on the navy hero is invisible; it must be light there and dark on the yellow band.
    assert.equal(await style('h1.pm-hero', 'caret-color'), 'rgb(255, 255, 255)')
    assert.notEqual(await style('p.pm-results', 'caret-color'), 'rgb(255, 255, 255)')
    assert.equal(await style('h1.pm-hero', 'text-wrap-style'), 'balance')
    assert.equal(await style('p.pm-challenge', 'text-wrap-style'), 'pretty')
    assert.include(await style('.stat-figure', 'font-variant-numeric'), 'tabular-nums')
  })

  test('motion is restrained: the sheet eases in once, and reduced motion turns it off', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-motion@example.test')
    await open(a)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    await page.locator('h1.pm-hero').waitFor()
    const animation = () =>
      page.locator('.ProseMirror').evaluate((el: any) => {
        const s = (globalThis as any).getComputedStyle(el)
        return {
          name: s.animationName,
          duration: s.animationDuration,
          timing: s.animationTimingFunction,
        }
      })
    const normal = await animation()
    assert.equal(normal.name, 'sheet-in')
    // Under 300ms and a strong ease-out, never the weak built-in curve.
    assert.isBelow(Number.parseFloat(normal.duration) * 1000, 300)
    assert.include(normal.timing, 'cubic-bezier(0.23, 1, 0.32, 1)')
    // Typing never triggers an animation: document blocks have no transition duration at all.
    const duration = await page
      .locator('.ProseMirror p.pm-challenge')
      .evaluate((el: any) => (globalThis as any).getComputedStyle(el).transitionDuration)
    assert.equal(duration, '0s')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal((await animation()).name, 'none')
  })

  test('the status bar has a page meter that shows how full the pages are', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-meter@example.test')
    await open(a)
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    const fill = page.locator('.page-meter > span')
    await fill.waitFor()
    const scale = async () =>
      fill.evaluate((el: any) => {
        const m = new (globalThis as any).DOMMatrix(
          (globalThis as any).getComputedStyle(el).transform
        )
        return m.a
      })
    const ratio = await scale()
    assert.isAbove(ratio, 0.2)
    assert.isBelow(ratio, 1)
    // It animates with transform only, which stays off the layout path.
    const property = await fill.evaluate(
      (el: any) => (globalThis as any).getComputedStyle(el).transitionProperty
    )
    assert.equal(property, 'transform, background-color')
    assert.equal(await page.locator('.page-status').getAttribute('data-state'), 'ok')
  })

  test('over the limit the meter is full and the alert eases in without a layout animation', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const a = await account('branded-meter-over@example.test')
    await open(a, 6)
    await new LayoutSelectionService().save(a.context, a.document.id, {
      templateId: 'case_study_concise',
      baseRevision: 0,
    })
    await browserContext.loginAs(a.user)
    const page = await visit(url(a))
    const alert = page.locator('.page-status').getByRole('alert')
    await alert.waitFor()
    assert.equal(await page.locator('.page-status').getAttribute('data-state'), 'over')
    const transition = await alert.evaluate((el: any) => {
      const s = (globalThis as any).getComputedStyle(el)
      return { property: s.transitionProperty, duration: s.transitionDuration }
    })
    assert.equal(transition.property, 'opacity, transform')
    assert.isBelow(Number.parseFloat(transition.duration) * 1000, 300)
    // The meter eases to full (a 300ms transform), so wait for it to settle before reading.
    const meter = page.locator('.page-meter > span')
    await page.waitForTimeout(450)
    const filled = await meter.evaluate(
      (el: any) =>
        new (globalThis as any).DOMMatrix((globalThis as any).getComputedStyle(el).transform).a
    )
    assert.approximately(filled, 1, 0.001)
  })
})
