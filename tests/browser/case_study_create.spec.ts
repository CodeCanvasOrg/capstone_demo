import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import drive from '@adonisjs/drive/services/main'
import Document from '#models/document'
import CanvasGenerationRun from '#models/canvas_generation_run'
import CanvasService from '#services/canvas/canvas_service'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'
import PortfolioTemplateSeed from '../../commands/portfolio_template_seed.ts'
import { reset } from '../helpers/workspaces.ts'
import {
  flagsOff,
  installPortfolioModel,
  portfolioGeneratable,
} from '../helpers/portfolio_generation.ts'

test.group('New case study: the portfolio layout', (group) => {
  let model: ReturnType<typeof installPortfolioModel> | undefined
  group.each.setup(async (current) => {
    // The create form's own Bee tour is a non-modal dialog that would cover the controls.
    await current.context.browserContext.addInitScript(() => {
      try {
        localStorage.setItem('codecanvas:bee-tour-create', 'done')
      } catch {
        // storage blocked: the tour simply shows
      }
    })
    await reset()
    drive.fake()
    await ace.create(PortfolioTemplateSeed, ['--no-previews']).then((c) => c.exec())
  })
  group.each.teardown(() => {
    model?.restore()
    model = undefined
    drive.restore()
    flagsOff()
  })

  test('a template case study: one portfolio card with its options, then the canvas shows the run and the pages', async ({
    browserContext,
    visit,
    assert,
  }) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    model = installPortfolioModel({ entries: 2, gate })
    const g = await portfolioGeneratable(1)
    await browserContext.loginAs(g.a.user)
    const page = await visit(`/workspaces/${g.a.workspace.id}/documents/create`)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    // Three ways to lay it out; the per-page designer is gone.
    const layout = page.getByRole('radiogroup', { name: 'How to lay out this case study' })
    await layout.waitFor()
    assert.deepEqual(
      await layout.getByRole('radio').evaluateAll((els) => els.map((e) => (e as any).value)),
      ['template', 'ai', 'plain']
    )
    assert.equal(await page.getByText('Choose each page').count(), 0)

    // The template: the portfolio card with its three page designs, and its options.
    const gallery = page.getByTestId('template-gallery')
    await gallery.waitFor()
    assert.include(await gallery.innerText(), 'Navy and gold portfolio')
    for (const label of ['Cover', 'Entry', 'Sources'])
      assert.equal(
        await gallery.getByRole('img', { name: `${label} page of the portfolio template` }).count(),
        1
      )
    assert.equal(await page.getByRole('radiogroup', { name: 'Brochure template' }).count(), 0)
    const entries = page.getByRole('radiogroup', { name: 'Entries' })
    const depth = page.getByRole('radiogroup', { name: 'Depth' })
    assert.include(await page.getByTestId('portfolio-layout').innerText(), 'Include images')
    await entries.getByRole('radio', { name: '2' }).click()
    await depth.getByRole('radio', { name: /Detailed/ }).click()
    assert.include(
      await page.getByTestId('portfolio-layout').innerText(),
      'A cover and 2 entries with their sources pages: about 5 pages.'
    )
    await page.getByLabel('Include images').click()

    await page
      .getByRole('textbox', { name: 'Case-study brief' })
      .fill('How the city was cooled with trees and paving.')
    await page.getByRole('button', { name: 'Generate', exact: true }).click()

    // It lands on the canvas, which shows the run while there are no pages yet.
    await page.waitForURL(/\/documents\/[^/]+\/canvas$/)
    const progress = page.getByTestId('generation-progress')
    await progress.waitFor()
    await page.getByRole('heading', { name: 'Writing your portfolio' }).waitFor()
    const doc = await Document.query().orderBy('createdAt', 'desc').firstOrFail()
    const layoutRow = await new LayoutSelectionService().peek(g.a.workspace.id, doc.id)
    assert.deepInclude(layoutRow.options.canvas as object, {
      templateSet: 'portfolio',
      entries: 2,
      depth: 'detailed',
      images: false,
    })
    const run = await CanvasGenerationRun.query().where('documentId', doc.id).firstOrFail()
    assert.equal(run.depth, 'detailed')

    const working = new TaskDispatchService().dispatch()
    release()
    await working
    await page.getByRole('button', { name: 'Show pages' }).first().click()
    await page.waitForLoadState('load')
    await page.frameLocator('iframe.gjs-frame').locator('.cv-sheet').nth(4).waitFor()
    const strip = page.getByRole('navigation', { name: 'Pages' })
    for (const label of ['Cover', 'Entry 1', 'Sources 1', 'Entry 2', 'Sources 2'])
      assert.include(await strip.innerText(), label)
    assert.deepEqual(errors, [])
  }).timeout(60_000)

  test('"Let AI choose" is labelled for the new behaviour and sends the AI options', async ({
    browserContext,
    visit,
    assert,
  }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable(1)
    await browserContext.loginAs(g.a.user)
    const page = await visit(`/workspaces/${g.a.workspace.id}/documents/create`)
    const layout = page.getByRole('radiogroup', { name: 'How to lay out this case study' })
    await layout.waitFor()
    assert.include(await layout.innerText(), 'AI designs every page from your materials')
    await layout.getByText('Let AI choose').click()
    assert.equal(await page.getByTestId('template-gallery').count(), 0)
    await page
      .getByRole('radiogroup', { name: 'Entries' })
      .getByRole('radio', { name: '3' })
      .click()
    await page
      .getByRole('textbox', { name: 'Case-study brief' })
      .fill('A brief for the AI to design.')
    const posted = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().endsWith('/documents')
    )
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    // The form posted: the case study is in canvas mode with the AI options as sent. (The canvas
    // page itself reads these options with the shared schema, which "ai_design" joins with the
    // AI design pipeline, so the landing is not asserted here.)
    await posted
    const doc = await Document.query().orderBy('createdAt', 'desc').firstOrFail()
    assert.equal(await new CanvasService().mode(g.a.workspace.id, doc.id), 'canvas')
    const saved = await new LayoutSelectionService().peek(g.a.workspace.id, doc.id)
    assert.deepInclude(saved.options.canvas as object, {
      templateSet: 'ai_design',
      entries: 3,
      depth: 'standard',
      images: true,
    })
  }).timeout(60_000)

  test('with canvas generation off the form says it writes a brochure and opens the case study', async ({
    browserContext,
    visit,
    assert,
  }) => {
    model = installPortfolioModel()
    const g = await portfolioGeneratable(1)
    flagsOff()
    await browserContext.loginAs(g.a.user)
    const page = await visit(`/workspaces/${g.a.workspace.id}/documents/create`)
    const layout = page.getByTestId('portfolio-layout')
    await layout.waitFor()
    assert.include(await layout.innerText(), 'Canvas page generation is off')
    assert.include(
      await page.getByRole('radiogroup', { name: 'How to lay out this case study' }).innerText(),
      'A ready-made brochure'
    )
    await page.getByRole('textbox', { name: 'Case-study brief' }).fill('A brief.')
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await page.waitForFunction(() => /\/documents\/[^/]+\/edit$/.test(location.pathname))
  }).timeout(60_000)
})
