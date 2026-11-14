import { test } from '@japa/runner'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import ContentService from '#services/documents/content_service'
import { documentSchema } from '../../shared/editor/schema.ts'

const text = (value: string, marks?: unknown[]) => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
})
const doc = (...content: unknown[]) => ({ type: 'doc', content })
const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content })
const item = (value: string) => ({ type: 'listItem', content: [paragraph(text(value))] })
const service = new ContentService()
const generated = (value: unknown) => service.normalize(value, { repair: true })
const loads = (value: unknown) => ProseMirrorNode.fromJSON(documentSchema(), value).check()

test.group('Document format: editor round trip', () => {
  test('keeps ordered list start and code language', ({ assert }) => {
    const saved = service.normalize(
      doc(
        { type: 'orderedList', attrs: { start: 5, type: null }, content: [item('five')] },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [text('x')] }
      )
    )
    assert.equal(saved.content[0].attrs?.start, 5)
    assert.equal(saved.content[1].attrs?.language, 'ts')
    assert.doesNotThrow(() => loads(saved))
  })

  test('keeps strike and underline marks the editor can create', ({ assert }) => {
    const input = doc(paragraph(text('x', [{ type: 'strike' }, { type: 'underline' }])))
    assert.deepEqual(service.normalize(input), input)
  })

  test('rejects content the editor schema would silently drop', ({ assert }) => {
    assert.throws(
      () =>
        service.normalize(
          doc({ type: 'heading', attrs: { level: 4 }, content: [{ type: 'bulletList' }] })
        ),
      'Invalid document content'
    )
  })

  test('only accepts links the editor itself allows', ({ assert }) => {
    const link = (href: string) => doc(paragraph(text('a', [{ type: 'link', attrs: { href } }])))
    assert.doesNotThrow(() => service.normalize(link('https://example.com')))
    assert.doesNotThrow(() => service.normalize(link('mailto:a@example.com')))
    for (const href of ['tel:+1', '/docs', 'javascript:alert(1)'])
      assert.throws(() => service.normalize(link(href)), 'Unsupported link protocol')
  })
})

test.group('Document format: model output repair', () => {
  test('keeps the draft when a model slips on levels, marks, links or wrappers', ({ assert }) => {
    const repaired = generated(
      doc(
        { type: 'heading', attrs: { level: 5 }, content: [text('Deep')] },
        { type: 'heading', attrs: { level: '2' }, content: [text('Two')] },
        { type: 'heading', attrs: null, content: [text('None')] },
        paragraph(
          text('mark', [{ type: 'highlight' }, { type: 'bold' }]),
          text('tel', [{ type: 'link', attrs: { href: 'tel:+1' } }])
        ),
        { type: 'callout', content: [paragraph(text('Inside'))] }
      )
    )
    assert.doesNotThrow(() => loads(repaired))
    assert.deepEqual(
      repaired.content.slice(0, 3).map((node) => node.attrs?.level),
      [4, 2, 2]
    )
    assert.deepEqual(repaired.content[3], paragraph(text('mark', [{ type: 'bold' }]), text('tel')))
    assert.deepEqual(repaired.content[4], paragraph(text('Inside')))
  })

  test('still rejects output with no recoverable structure', ({ assert }) => {
    assert.throws(() => generated({ type: 'doc', content: 'text' }), 'Invalid document content')
  })
})
