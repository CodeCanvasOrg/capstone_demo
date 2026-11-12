import { test } from '@japa/runner'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import ExportPdfService from '#services/exports/pdf_service'

const cite = (id: string, page = 1) => ({
  type: 'sourceCitation',
  attrs: {
    sourceChunkId: id,
    fileName: 'case.pdf',
    pageNumber: page,
    chunkText: 'INTERNAL EXCERPT',
    fileUrl: '/workspaces/w/documents/d/evidence/x',
  },
})

const doc = {
  type: 'doc' as const,
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Summary.' }, cite('a')] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Results' }] },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Claim.' }, cite('b', 2), cite('a'), cite('a')],
    },
  ],
}

test.group('PublicationProjectionService', () => {
  test('numbers references by first appearance and deduplicates by chunk', ({ assert }) => {
    const result = new PublicationProjectionService().project(doc)
    assert.equal(result.title, 'Title')
    assert.deepEqual(
      result.sources.map((s) => s.number),
      [1, 2]
    )
    assert.equal(result.sources[1].label, 'case.pdf, p. 2')
    const refs = result.body[1].content!.filter((n) => n.type === 'reference')
    assert.deepEqual(
      refs.map((n) => n.attrs!.number),
      [2, 1] // adjacent duplicate collapsed
    )
  })

  test('drops internal metadata and leaves the saved body untouched', ({ assert }) => {
    const before = JSON.stringify(doc)
    const result = new PublicationProjectionService().project(doc)
    assert.notInclude(JSON.stringify(result), 'INTERNAL EXCERPT')
    assert.notInclude(JSON.stringify(result), 'evidence')
    assert.equal(JSON.stringify(doc), before)
  })

  test('publication html renders hero, superscripts and sources', async ({ assert }) => {
    const html = await ExportPdfService.html({ content: doc } as any, { publication: true })
    assert.include(html, 'class="hero"')
    assert.include(html, '<sup class="ref">1</sup>')
    assert.include(html, '<h2>Sources</h2>')
    assert.notInclude(html, 'INTERNAL EXCERPT')
  })
})
