/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import CanvasGenerationRun from '#models/canvas_generation_run'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import { reset } from '../helpers/workspaces.ts'
import { flagsOff, generatable, installModel } from '../helpers/canvas_generation.ts'

test.group('Canvas generation: the dialog, progress and page actions', (group) => {
  let model: ReturnType<typeof installModel> | undefined
  group.each.setup(async () => {
    await reset()
    drive.fake()
  })
  group.each.teardown(() => {
    model?.restore()
    drive.restore()
    flagsOff()
  })

  test('choose Academic and Detailed, watch the stepper, see badges, add depth to a page', async ({
    browserContext,
    visit,
    assert,
  }) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    // The second page is written thin, so "Add depth" has something to do.
    model = installModel({ gate, first: { two_column: 0.45 }, corrected: [0.45, 0.9] })
    const g = await generatable()
    await browserContext.loginAs(g.a.user)
    const page = await visit(`/workspaces/${g.a.workspace.id}/documents/${g.a.document.id}/canvas`)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.frameLocator('iframe.gjs-frame').locator('.cv-sheet').first().waitFor()

    // The dialog: Academic and Detailed, with the words a page shown.
    await page.getByTestId('generate-pages').click()
    const dialog = page.getByRole('dialog', { name: 'Generate pages' })
    await dialog.waitFor()
    await dialog
      .getByRole('radiogroup', { name: 'Style' })
      .getByRole('radio', { name: /Academic/ })
      .click()
    await dialog
      .getByRole('radiogroup', { name: 'Depth' })
      .getByRole('radio', { name: /Detailed/ })
      .click()
    assert.match(
      (await dialog.getByRole('radio', { name: /Detailed/ }).innerText()).replace(/\s+/g, ' '),
      /≈ \d+ words a page/
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
    const run = await CanvasGenerationRun.query().where('documentId', g.a.document.id).firstOrFail()
    assert.equal(run.depth, 'detailed')
    assert.equal(run.profile, 'academic')
    const working = new TaskDispatchService().dispatch()
    await page.getByRole('listitem').filter({ hasText: 'Planning' }).first().waitFor()
    assert.equal(
      await progress
        .locator('[aria-current="step"]')
        .innerText()
        .then((t) => t.trim()),
      'Planning'
    )
    release()
    await working

    // Pages are ready: the toast and the stepper offer them; reloading shows the badges.
    await page
      .getByTestId('generation-progress')
      .getByRole('button', { name: 'Show pages' })
      .click()
    await page.waitForLoadState('load')
    await page.frameLocator('iframe.gjs-frame').locator('.cv-sheet').nth(6).waitFor()
    const badges = page.getByTestId('page-quality')
    await badges.first().waitFor()
    // Five content pages carry a badge: the title page and four content pages.
    assert.equal(await badges.count(), 5)
    assert.equal(
      await page.getByRole('navigation', { name: 'Pages' }).getByRole('listitem').count(),
      7
    )
    const thin = page
      .getByRole('listitem')
      .filter({ hasText: 'two column' })
      .getByTestId('page-quality')
    assert.equal(await thin.getAttribute('data-level'), 'warn')
    const before = Number(/(\d+)w/.exec(await thin.innerText())![1])

    // "Add depth" on the thin page: a new run, and its badge improves.
    const strip = page.getByRole('listitem').filter({ hasText: 'two column' })
    await strip.hover()
    await strip.getByRole('button', { name: /Page 4 actions/ }).click()
    await page.getByRole('menuitem', { name: 'Add depth' }).click()
    await page.getByTestId('generation-progress').waitFor()
    await new TaskDispatchService().dispatch()
    await page
      .getByTestId('generation-progress')
      .getByRole('button', { name: 'Show pages' })
      .click()
    await page.waitForLoadState('load')
    await page.frameLocator('iframe.gjs-frame').locator('.cv-sheet').nth(6).waitFor()
    const after = page
      .getByRole('listitem')
      .filter({ hasText: 'two column' })
      .getByTestId('page-quality')
    await after.waitFor()
    assert.isAbove(Number(/(\d+)w/.exec(await after.innerText())![1]), before)
    assert.equal(await after.getAttribute('data-level'), 'ok')
    assert.deepEqual(errors, [])
  })

  test('the controls are absent when generation is off', async ({
    browserContext,
    visit,
    assert,
  }) => {
    model = installModel()
    const g = await generatable()
    ;(await import('#start/env')).default.set('CANVAS_GENERATION', undefined as never)
    await browserContext.loginAs(g.a.user)
    const page = await visit(`/workspaces/${g.a.workspace.id}/documents/${g.a.document.id}/canvas`)
    await page.frameLocator('iframe.gjs-frame').locator('.cv-sheet').first().waitFor()
    assert.equal(await page.getByTestId('generate-pages').count(), 0)
    assert.equal(await page.getByText('Write detailed, cited pages').count(), 0)
  })
})
