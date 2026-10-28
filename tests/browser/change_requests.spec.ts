import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import VersionService from '#services/documents/version_service'
import DocumentVersion from '#models/document_version'
import { account, reset, source } from '../helpers/workspaces.ts'

const screenshots = process.env.UI_SCREENSHOT_DIR
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

test.group('Change requests', (group) => {
  group.each.setup(() => reset())
  test('a brief can be sent without choosing a template', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('ui-send@example.test')
    await browserContext.loginAs(fixture.user)
    const page = await visit(`/workspaces/${fixture.workspace.id}/documents/create`)
    const send = page.getByRole('button', { name: 'Send', exact: true })
    assert.isTrue(await send.isDisabled())
    let body: Record<string, unknown> = {}
    await page.route(`**/workspaces/${fixture.workspace.id}/documents`, (route) => {
      body = route.request().postDataJSON()
      return route.abort()
    })
    await page.getByRole('textbox', { name: 'Case-study brief' }).fill('A freeform brief')
    await send.click()
    await page.waitForTimeout(300)
    assert.isNull(body.templateId)
    assert.equal(body.description, 'A freeform brief')
    if (screenshots) await page.screenshot({ path: `${screenshots}/create-send.png` })
  })
  test('asking for a change applies the edit in place and autosaves it', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('ui-change@example.test')
    await new VersionService().save(fixture.context, fixture.document.id, {
      baseVersionId: null,
      mutationId: randomUUID(),
      content: { type: 'doc', content: [paragraph('Keep this intro'), paragraph('Long results')] },
    })
    await browserContext.loginAs(fixture.user)
    const page = await visit(
      `/workspaces/${fixture.workspace.id}/documents/${fixture.document.id}/edit`
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    let instruction = ''
    await page.route('**/revisions', async (route) => {
      instruction = route.request().postDataJSON().instruction
      await new Promise((resolve) => setTimeout(resolve, 300))
      return route.fulfill({
        json: {
          data: {
            content: { type: 'doc', content: [paragraph('Keep this intro'), paragraph('Short')] },
            summary: 'Shortened the results.',
            changed: true,
          },
        },
      })
    })
    await page.getByRole('button', { name: 'Ask for a change' }).click()
    const prompt = page.getByRole('textbox', { name: 'Describe the change' })
    await prompt.waitFor()
    assert.equal(await page.locator('#change-request:focus').count(), 1)
    const box = (await page.getByRole('form', { name: 'Ask for a change' }).boundingBox())!
    const viewport = page.viewportSize()!
    assert.isAbove(box.y, viewport.height / 2)
    await prompt.fill('Make the results shorter')
    if (screenshots) await page.screenshot({ path: `${screenshots}/change-open.png` })
    const saved = page.waitForRequest(
      (request) => request.url().endsWith('/versions') && request.method() === 'POST'
    )
    await prompt.press('Enter')
    await page.getByText('Shortened the results.').waitFor()
    const editor = page.getByRole('textbox', { name: 'Case-study content' })
    assert.equal(await editor.innerText(), 'Keep this intro\n\nShort')
    assert.equal(instruction, 'Make the results shorter')
    const save = await saved
    assert.include(JSON.stringify(save.postDataJSON().content), 'Short')
    if (screenshots) await page.screenshot({ path: `${screenshots}/change-applied.png` })
    await page.getByRole('button', { name: 'Undo change' }).click()
    assert.include(await editor.innerText(), 'Long results')
    await prompt.press('Escape')
    assert.equal(await page.getByRole('form', { name: 'Ask for a change' }).count(), 0)
    assert.deepEqual(errors, [])
  })
  test('a stored draft with top-level citations opens and stays editable', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('ui-repair@example.test')
    const { chunkId } = await source(fixture)
    const citation = { type: 'sourceCitation', attrs: { sourceChunkId: chunkId } }
    // Written directly, the way older generations stored model output.
    const version = await DocumentVersion.create({
      workspaceId: fixture.workspace.id,
      documentId: fixture.document.id,
      userId: fixture.user.id,
      version: 1,
      content: {
        type: 'doc',
        content: [paragraph('A cited claim.'), citation, paragraph('Next paragraph.'), citation],
      },
      mutationId: randomUUID(),
      requestHash: 'x'.repeat(64),
    })
    await fixture.document.merge({ currentVersionId: version.id }).save()
    await browserContext.loginAs(fixture.user)
    const page = await visit(
      `/workspaces/${fixture.workspace.id}/documents/${fixture.document.id}/edit`
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const editor = page.getByRole('textbox', { name: 'Case-study content' })
    await editor.getByText('Next paragraph.').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Edited.')
    const body = await editor.innerText()
    assert.include(body, 'Edited.')
    // Both citations survive the repair, now inside the paragraphs they cite.
    assert.lengthOf(body.match(/source\.txt/g) ?? [], 2)
    assert.deepEqual(errors, [])
  })
})
