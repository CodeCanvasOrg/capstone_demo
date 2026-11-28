/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import drive from '@adonisjs/drive/services/main'
import CanvasGenerationRun from '#models/canvas_generation_run'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import PortfolioTemplateSeed from '../../commands/portfolio_template_seed.ts'
import { reset } from '../helpers/workspaces.ts'
import {
  flagsOff,
  installPortfolioModel,
  portfolioGeneratable,
} from '../helpers/portfolio_generation.ts'

test.group('Portfolio generation: the dialog, progress and page actions', (group) => {
  let model: ReturnType<typeof installPortfolioModel> | undefined
  group.each.setup(async () => {
    await reset()
    drive.fake()
    await ace.create(PortfolioTemplateSeed, ['--no-previews']).then((c) => c.exec())
  })
  group.each.teardown(() => {
    model?.restore()
    drive.restore()
    flagsOff()
  })

  test('the dialog shows the one template; choose two entries and Detailed, watch the stepper, add depth to an entry', async ({
    browserContext,
    visit,
    assert,
  }) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    model = installPortfolioModel({ gate, entries: 2 })
    const g = await portfolioGeneratable()
    await browserContext.loginAs(g.a.user)
    const page = await visit(`/workspaces/${g.a.workspace.id}/documents/${g.a.document.id}/canvas`)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.frameLocator('iframe.gjs-frame').locator('.cv-sheet').first().waitFor()

    // The dialog: one template with its three page designs, and the choices that shape it.
    await page.getByTestId('generate-pages').click()
    const dialog = page.getByRole('dialog', { name: 'Generate pages' })
    await dialog.waitFor()
    const gallery = dialog.getByTestId('template-gallery')
    await gallery.waitFor()
    assert.include(await gallery.innerText(), 'Navy and gold portfolio')
    for (const label of ['Cover', 'Entry', 'Sources'])
      assert.equal(
        await gallery.getByRole('img', { name: `${label} page of the portfolio template` }).count(),
        1
      )
    // No set, style or page-count choice remains.
    assert.equal(await dialog.getByRole('radiogroup', { name: 'Template set' }).count(), 0)
    assert.equal(await dialog.getByRole('radiogroup', { name: 'Style' }).count(), 0)
    await dialog
      .getByRole('radiogroup', { name: 'Entries' })
      .getByRole('radio', { name: '2' })
      .click()
    await dialog
      .getByRole('radiogroup', { name: 'Depth' })
      .getByRole('radio', { name: /Detailed/ })
      .click()
    assert.include(
      await dialog.innerText(),
      'A cover and 2 entries with their sources pages: about 5 pages.'
    )
    assert.equal(
      await dialog
        .getByRole('radiogroup', { name: 'Depth' })
        .getByRole('radio', { checked: true })
        .count(),
      1
    )
    await dialog.getByRole('button', { name: 'Generate pages' }).click()
    await dialog.waitFor({ state: 'hidden' })

    // The run is queued and the stepper shows it. The worker (the test) picks it up.
    const progress = page.getByTestId('generation-progress')
    await progress.waitFor()
    // A whole-document generation brings Bo over the screen; it never blocks the stepper.
    await page.locator('.bee-stage[data-open="true"]').waitFor()
    const run = await CanvasGenerationRun.query().where('documentId', g.a.document.id).firstOrFail()
    assert.equal(run.depth, 'detailed')
    assert.equal(run.templateSet, 'portfolio')
    const working = new TaskDispatchService().dispatch()
    await page.getByRole('listitem').filter({ hasText: 'Planning the entries' }).first().waitFor()
    assert.equal(
      await progress
        .locator('[aria-current="step"]')
        .innerText()
        .then((t) => t.trim()),
      'Planning the entries'
    )
    release()
    await working

    // Pages are ready: the stepper offers them; the strip names each page; entries carry a badge.
    await progress.getByRole('button', { name: 'Show pages' }).click()
    await page.waitForLoadState('load')
    await page.frameLocator('iframe.gjs-frame').locator('.cv-sheet').nth(4).waitFor()
    const strip = page.getByRole('navigation', { name: 'Pages' })
    assert.equal(await strip.getByRole('listitem').count(), 5)
    const text = await strip.innerText()
    for (const label of ['Cover', 'Entry 1', 'Sources 1', 'Entry 2', 'Sources 2'])
      assert.include(text, label)
    assert.equal(await page.getByTestId('page-quality').count(), 2)

    // The canvas draws the template: Inter, and footnotes as gold superscript numbers.
    const frame = page.frameLocator('iframe.gjs-frame')
    const body = frame.locator('[id$="-entry-rows-1-body"]').first()
    await body.waitFor()
    assert.match(await body.evaluate((el) => getComputedStyle(el).fontFamily), /Inter/)
    const sup = body.locator('sup.ref')
    assert.equal((await sup.first().innerText()).trim(), '1')
    assert.equal(
      await sup.first().evaluate((el) => getComputedStyle(el).color),
      'rgb(138, 106, 16)'
    )
    assert.equal(await frame.locator('.tiptap-source-citation').count(), 0)

    // "Add depth" on an entry: a new run, only entries have it; the sources page has no menu.
    const entryItem = page.getByRole('listitem').filter({ hasText: 'Entry 1' })
    await entryItem.hover()
    await entryItem.getByRole('button', { name: /Page 2 actions/ }).click()
    assert.equal(await page.getByRole('menuitem', { name: 'Change design' }).count(), 0)
    await page.getByRole('menuitem', { name: 'Add depth' }).click()
    await page.getByTestId('generation-progress').waitFor()
    // One page's rewrite keeps the editor in view: no swarm.
    assert.equal(await page.locator('.bee-stage').count(), 0)
    await new TaskDispatchService().dispatch()
    await page
      .getByTestId('generation-progress')
      .getByRole('button', { name: 'Show pages' })
      .click()
    await page.waitForLoadState('load')
    await page.frameLocator('iframe.gjs-frame').locator('.cv-sheet').nth(4).waitFor()
    const sources = page.getByRole('listitem').filter({ hasText: 'Sources 1' })
    await sources.hover()
    assert.equal(await sources.getByRole('button', { name: /actions/ }).count(), 0)
    assert.deepEqual(errors, [])
  })

  test('the controls are absent when generation is off', async ({
    browserContext,
    visit,
    assert,
  }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable()
    ;(await import('#start/env')).default.set('CANVAS_GENERATION', undefined as never)
    await browserContext.loginAs(g.a.user)
    const page = await visit(`/workspaces/${g.a.workspace.id}/documents/${g.a.document.id}/canvas`)
    await page.frameLocator('iframe.gjs-frame').locator('.cv-sheet').first().waitFor()
    assert.equal(await page.getByTestId('generate-pages').count(), 0)
    assert.equal(await page.getByText('Writes a cited portfolio').count(), 0)
  })
})
