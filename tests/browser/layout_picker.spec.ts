import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import LayoutSelectionService from '#services/layout/layout_selection_service'
import VersionService from '#services/documents/version_service'
import { account, reset } from '../helpers/workspaces.ts'

const body = (title: string) => ({
  type: 'doc' as const,
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'A short summary.' }] },
  ],
})

test.group('Layout picker and collections (TPL-05, PRT-01)', (group) => {
  group.each.setup(() => reset())

  test('pick a template, see page budgets, save, and the layout is pinned', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('layout-picker@example.test')
    await new VersionService().save(fixture.context, fixture.document.id, {
      content: body('Faster onboarding'),
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    await browserContext.loginAs(fixture.user)
    const page = await visit(
      `/workspaces/${fixture.workspace.id}/documents/${fixture.document.id}/edit`
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.getByText('Layout and branding').click()
    const form = page.locator('details', { hasText: 'Layout and branding' })
    await form.getByText('Case study — concise').waitFor()
    // Budgets are stated up front, with sources counted.
    assert.isTrue(await form.getByText('Up to 1 page, sources included').isVisible())
    assert.isTrue(await form.getByText('Up to 2 pages, sources included').isVisible())
    // Fit is reported for the saved version.
    await form.getByRole('region', { name: 'Page fit' }).waitFor()

    const save = form.getByRole('button', { name: 'Save layout' })
    assert.isTrue(await save.isDisabled(), 'nothing to save until a choice changes')
    await form.getByLabel(/Case study — concise/).check()
    assert.isTrue(await form.getByText(/withdraws any review or approval/).isVisible())
    await save.click()
    await page.waitForResponse((r) => r.url().endsWith('/layout') && r.request().method() === 'PUT')

    const selection = await new LayoutSelectionService().resolve(
      fixture.context,
      fixture.document.id
    )
    assert.equal(selection.templateId, 'case_study_concise')
    assert.equal(selection.templateVersion, 1)
    assert.deepEqual(errors, [])
  })

  test('create a collection, read the budget arithmetic, and approve it', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('collection-ui@example.test')
    await new VersionService().save(fixture.context, fixture.document.id, {
      content: body('Faster onboarding'),
      baseVersionId: null,
      mutationId: randomUUID(),
    })
    await browserContext.loginAs(fixture.user)
    const page = await visit(`/workspaces/${fixture.workspace.id}/collections`)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.getByLabel('Name', { exact: true }).fill('Selected work')
    await page.getByLabel('Company introduction (optional)').fill('We build document AI.')
    await page.getByRole('checkbox', { name: fixture.document.title! }).check()
    await page.getByRole('button', { name: 'Create collection' }).click()

    const budget = page.getByRole('region', { name: 'Page budget' })
    await budget.waitFor()
    // Cover, introduction, contents and back cover (4) + one standard entry (2) = 6.
    assert.isTrue(await budget.getByText(/= 6 of 20 pages/).isVisible())

    await page.getByRole('button', { name: 'Approve this collection' }).click()
    await page.getByText('Approved', { exact: true }).first().waitFor()
    assert.isTrue(await page.getByRole('button', { name: 'Approve this collection' }).isDisabled())
    assert.deepEqual(errors, [])
  })
})
