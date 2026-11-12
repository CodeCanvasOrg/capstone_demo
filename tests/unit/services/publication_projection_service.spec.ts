import { test } from '@japa/runner'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import ExportPdfService from '#services/exports/pdf_service'
import { ClientContentError } from '../../../shared/publication/client.ts'

const cite = (id: string, page = 1, fileName = 'case.pdf') => ({
  type: 'sourceCitation',
  attrs: {
    sourceChunkId: id,
    fileName,
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

const project = (content: unknown[]) =>
  new PublicationProjectionService().project({ type: 'doc', content } as any)

test.group('PublicationProjectionService', () => {
  test('numbers references by first appearance and deduplicates by chunk', ({ assert }) => {
    const { client } = new PublicationProjectionService().project(doc)
    assert.equal(client.title, 'Title')
    assert.deepEqual(
      client.sources.map((s) => s.number),
      [1, 2]
    )
    assert.deepEqual(client.sources[1], { number: 2, label: 'case.pdf', page: 2 })
    const paragraph = client.body[1]
    const refs =
      paragraph.type === 'paragraph' ? paragraph.content!.filter((n) => n.type === 'reference') : []
    assert.deepEqual(
      refs.map((n) => n.type === 'reference' && n.number),
      [2, 1] // adjacent duplicate collapsed
    )
  })

  test('drops internal metadata and leaves the saved body untouched', ({ assert }) => {
    const before = JSON.stringify(doc)
    const { client, identity } = new PublicationProjectionService().project(doc)
    const out = JSON.stringify(client)
    for (const secret of ['INTERNAL EXCERPT', 'evidence', 'sourceChunkId', 'fileUrl', 'chunkText'])
      assert.notInclude(out, secret)
    assert.equal(JSON.stringify(doc), before)
    assert.match(identity.contentHash, /^[0-9a-f]{64}$/)
    assert.notProperty(client, 'identity')
  })

  test('reviewer notes and unknown attributes never reach the client', ({ assert }) => {
    const { client } = project([
      {
        type: 'paragraph',
        attrs: { reviewerNotes: 'OUT03_PRIVATE_NOTE' },
        content: [{ type: 'text', text: 'Visible.' }],
      },
    ])
    assert.notInclude(JSON.stringify(client), 'OUT03_PRIVATE_NOTE')
  })

  test('hostile nodes, marks, links and image sources fail with exact fields', ({ assert }) => {
    const fields = (content: unknown[]) => {
      // Lead with a title and summary so `content` lands at body[0].
      const lead = [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'T' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'S' }] },
      ]
      try {
        project([...lead, ...content])
      } catch (error) {
        if (error instanceof ClientContentError) return error.issues
        throw error
      }
      return []
    }
    assert.deepEqual(fields([{ type: 'script' }]), [
      { field: 'body[0].type', code: 'unknown_node' },
    ])
    assert.deepEqual(
      fields([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [{ type: 'highlight' }] }],
        },
      ]),
      [{ field: 'body[0].content[0].marks[0].type', code: 'unknown_mark' }]
    )
    assert.deepEqual(
      fields([
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ]),
      [{ field: 'body[0].content[0].marks[0].href', code: 'unsafe_link' }]
    )
    assert.deepEqual(
      fields([{ type: 'image', attrs: { src: '/workspaces/w/files/secret.png' } }]),
      [{ field: 'body[0].src', code: 'unsafe_image_source' }]
    )
  })

  test('unusable source names become neutral labels, not basenames', ({ assert }) => {
    const { client } = project([
      { type: 'paragraph', content: [cite('a', 1, '/Users/me/private/secret.pdf')] },
    ])
    assert.equal(client.sources[0].label, 'Source 1')
  })

  test('absent optionals are omitted without placeholders', ({ assert }) => {
    const { client } = project([{ type: 'paragraph', content: [{ type: 'text', text: 'Only.' }] }])
    assert.notProperty(client, 'title')
    assert.deepEqual(client.sources, [])
  })

  test('qualifiers survive projection verbatim', ({ assert }) => {
    const text = 'Up to 40% faster (estimated, client-reported, design target) in Q3 2025.'
    const { client } = project([{ type: 'paragraph', content: [{ type: 'text', text }] }])
    assert.include(JSON.stringify(client), text)
  })

  for (const publication of [false, true])
    test(`html (${publication ? 'pilot' : 'legacy'} layout) renders hero content and sources without internals`, async ({
      assert,
    }) => {
      const { client } = new PublicationProjectionService().project(doc)
      const html = await ExportPdfService.html(client, { publication })
      assert.include(html, '<h1>Title</h1>')
      assert.include(html, '<sup class="ref">1</sup>')
      assert.include(html, '<h2>Sources</h2>')
      assert.include(html, publication ? 'class="hero"' : '<h1>')
      for (const secret of ['INTERNAL EXCERPT', '/workspaces/', 'data-source', 'href='])
        assert.notInclude(html, secret)
    })

  test('layouts reject anything that is not the client DTO', async ({ assert }) => {
    await assert.rejects(() => ExportPdfService.html({ content: doc } as any), /Invalid client/)
    await assert.rejects(() =>
      ExportPdfService.html({ ...project([]).client, reviewerNotes: 'x' } as any, {
        publication: true,
      })
    )
  })
})
