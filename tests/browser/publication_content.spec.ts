import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import VersionService from '#services/documents/version_service'
import PublicationContentService from '#services/documents/publication_content_service'
import { account, reset } from '../helpers/workspaces.ts'
import { legacyCaseStudy } from '../fixtures/publication/legacy_case_study.ts'

const plain = () => {
  const doc = structuredClone(legacyCaseStudy)
  doc.content = doc.content.filter((node) => node.type !== 'image')
  doc.content[3].content = doc.content[3].content!.filter((c) => c.type !== 'sourceCitation')
  return doc
}

test.group('Publication content in the editor', (group) => {
  group.each.setup(() => reset())

  test('metadata and IDs survive editing; field errors keep the draft and focus the block', async ({
    browserContext,
    visit,
    assert,
  }) => {
    const fixture = await account('ui-publication@example.test')
    const { document: mapped } = new PublicationContentService().mapLegacy(plain(), 'ns')
    await new VersionService().save(fixture.context, fixture.document.id, {
      baseVersionId: null,
      mutationId: randomUUID(),
      content: mapped,
    })
    await browserContext.loginAs(fixture.user)
    const page = await visit(
      `/workspaces/${fixture.workspace.id}/documents/${fixture.document.id}/edit`
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const editor = page.getByRole('textbox', { name: 'Case-study content' })
    await editor.waitFor()
    const titleId = mapped.content[0].attrs!.nodeId as string
    assert.equal(await page.locator(`h1[data-node-id="${titleId}"]`).count(), 1)

    let posted: any = null
    await page.route('**/versions', (route) => {
      posted = route.request().postDataJSON()
      return route.fulfill({
        status: 422,
        json: {
          error: {
            code: 'E_PUBLICATION_CONTENT',
            message: 'Check the highlighted content fields.',
            retryable: false,
          },
          errors: [
            {
              field: 'content.attrs.publication.hero.title.nodeId',
              message: 'Link this to an existing paragraph or heading.',
            },
          ],
        },
      })
    })
    await page.locator('p', { hasText: 'Summary of the work' }).click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Edited')
    await page.waitForRequest((request) => request.url().endsWith('/versions'))
    // Root metadata and block IDs travel with the editor's own JSON.
    await page.waitForFunction(() =>
      (globalThis as any).document.body.innerText.includes('Fix 1 problem')
    )
    assert.deepEqual(posted.content.attrs.publication, mapped.attrs!.publication)
    assert.equal(posted.content.content[0].attrs.nodeId, titleId)

    const summary = page.getByRole('alert').filter({ hasText: 'Fix 1 problem' })
    assert.include(await summary.innerText(), 'Hero · title · link')
    assert.include(await summary.innerText(), 'Link this to an existing paragraph or heading.')
    assert.equal(await page.getByRole('heading', { name: /Fix 1 problem/ }).count(), 0)
    assert.isTrue(
      await summary
        .getByText('Fix 1 problem')
        .evaluate((el) => el === (globalThis as any).document.activeElement)
    )
    // The unsaved text is still in the editor.
    assert.include(await editor.innerText(), 'Summary of the work 🚀. Edited')

    await summary.getByRole('button', { name: /Go to text/ }).click()
    const inTitle = await page.evaluate((id) => {
      const g = globalThis as any
      const anchor = g.getSelection()?.anchorNode?.parentElement
      return (
        !!g.document.activeElement?.closest('.tiptap') &&
        !!anchor?.closest(`[data-node-id="${id}"]`)
      )
    }, titleId)
    assert.isTrue(inTitle)
    assert.deepEqual(errors, [])
  })
})
