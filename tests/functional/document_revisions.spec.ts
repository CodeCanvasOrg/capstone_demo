import { test } from '@japa/runner'
import { account, reset } from '../helpers/workspaces.ts'
import Document from '#models/document'
import OpenRouterService from '#services/open_router_service'
import TaskDispatchService from '#services/workspaces/task_dispatch_service'

const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original draft.' }] }],
}
const revised = {
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Revised draft.' }] }],
}

test.group('Document change requests', (group) => {
  group.each.setup(reset)
  test('returns the revised editor content without saving a version', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const original = OpenRouterService.prototype.reviseDocument
    const seen: { instruction?: string; content?: unknown } = {}
    OpenRouterService.prototype.reviseDocument = async (document, instruction) => {
      seen.instruction = instruction
      seen.content = document
      return { document: revised, summary: 'Reworded the draft.', changed: true }
    }
    try {
      const response = await client
        .post(`/workspaces/${a.workspace.id}/documents/${a.document.id}/revisions`)
        .loginAs(a.user)
        .withCsrfToken()
        .header('accept', 'application/json')
        .json({ content, instruction: '  Reword it  ' })
      response.assertStatus(200)
      assert.deepEqual(response.body().data.content, revised)
      assert.equal(response.body().data.summary, 'Reworded the draft.')
      assert.equal(seen.instruction, 'Reword it')
      assert.deepEqual(seen.content, content)
      assert.lengthOf(await a.document.related('documentVersions').query(), 0)
    } finally {
      OpenRouterService.prototype.reviseDocument = original
    }
  })

  test('hides provider failures behind a safe message', async ({ client, assert }) => {
    const a = await account()
    const original = OpenRouterService.prototype.reviseDocument
    OpenRouterService.prototype.reviseDocument = async () => {
      throw Object.assign(new Error('Sensitive provider response'), { status: 500 })
    }
    try {
      const response = await client
        .post(`/workspaces/${a.workspace.id}/documents/${a.document.id}/revisions`)
        .loginAs(a.user)
        .withCsrfToken()
        .header('accept', 'application/json')
        .json({ content, instruction: 'Reword it' })
      response.assertStatus(502)
      assert.notInclude(JSON.stringify(response.body()), 'Sensitive provider response')
    } finally {
      OpenRouterService.prototype.reviseDocument = original
    }
  })

  test('other workspaces cannot request changes to a case study', async ({ client }) => {
    const a = await account()
    const b = await account('bob@example.test')
    const response = await client
      .post(`/workspaces/${b.workspace.id}/documents/${a.document.id}/revisions`)
      .loginAs(b.user)
      .withCsrfToken()
      .header('accept', 'application/json')
      .json({ content, instruction: 'Reword it' })
    response.assertStatus(404)
  })

  test('sending a brief without a template writes a freeform case study', async ({
    client,
    assert,
  }) => {
    const a = await account()
    const originalDocument = OpenRouterService.prototype.generateDocumentWithEvidence
    const originalOutline = OpenRouterService.prototype.generateOutlineWithEvidence
    const originalTitle = OpenRouterService.prototype.generateTitle
    let freeform = 0
    OpenRouterService.prototype.generateTitle = async () => 'Freeform Story'
    OpenRouterService.prototype.generateDocumentWithEvidence = async (_t, _b, _c, guard) => {
      await guard?.()
      freeform++
      return revised
    }
    OpenRouterService.prototype.generateOutlineWithEvidence = async () => {
      throw new Error('A freeform brief must not use an outline')
    }
    try {
      const response = await client
        .post(`/workspaces/${a.workspace.id}/documents`)
        .loginAs(a.user)
        .withCsrfToken()
        .redirects(0)
        .json({ templateId: null, description: 'A freeform brief', sourceMode: 'input_only' })
      response.assertStatus(302)
      const doc = await Document.findByOrFail('description', 'A freeform brief')
      assert.notProperty(doc.templateSetup, 'outline')
      await new TaskDispatchService().dispatch()
      await doc.refresh()
      assert.equal(doc.generationStatus, 'ready')
      assert.equal(freeform, 1)
    } finally {
      OpenRouterService.prototype.generateDocumentWithEvidence = originalDocument
      OpenRouterService.prototype.generateOutlineWithEvidence = originalOutline
      OpenRouterService.prototype.generateTitle = originalTitle
    }
  })
})
