import { test } from '@japa/runner'
import { Node, getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import ContentService from '#services/documents/content_service'

// The editor's schema, with the same inline citation node it registers.
const schema = getSchema([
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
  Image,
  Node.create({
    name: 'sourceCitation',
    group: 'inline',
    inline: true,
    atom: true,
    addAttributes: () => ({ sourceChunkId: { default: null } }),
  }),
])
const text = (value: string) => ({ type: 'text', text: value })
const citation = { type: 'sourceCitation', attrs: { sourceChunkId: 'chunk-1' } }
const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content })
const valid = (document: unknown) => ProseMirrorNode.fromJSON(schema, document).check()
const repair = (value: unknown) => new ContentService().normalize(value, { repair: true })

test.group('Content structure repair', () => {
  test('moves top-level citations into the paragraph they follow', ({ assert }) => {
    const repaired = repair({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [text('Summary')] },
        paragraph(text('A claim.')),
        citation,
        citation,
        { type: 'heading', attrs: { level: 2 }, content: [text('Next')] },
        citation,
        text('Loose text'),
      ],
    })
    assert.deepEqual(repaired.content, [
      { type: 'heading', attrs: { level: 2 }, content: [text('Summary')] },
      paragraph(text('A claim.'), citation, citation),
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [text('Next'), citation, text('Loose text')],
      },
    ])
    assert.doesNotThrow(() => valid(repaired))
  })

  test('repairs nested blocks, malformed lists and empty text nodes', ({ assert }) => {
    const repaired = repair({
      type: 'doc',
      content: [
        paragraph(text('Before'), paragraph(text('Nested')), text('After'), text('')),
        { type: 'bulletList', content: [text('Bare item'), { type: 'listItem', content: [] }] },
        { type: 'listItem', content: [paragraph(text('Orphan item'))] },
        { type: 'orderedList', content: [] },
        { type: 'blockquote', content: [] },
        { type: 'codeBlock', content: [paragraph(text('code'))] },
        { type: 'horizontalRule', content: [paragraph(text('x'))] },
      ],
    })
    assert.doesNotThrow(() => valid(repaired))
    assert.deepEqual(repaired.content.slice(0, 3), [
      paragraph(text('Before')),
      paragraph(text('Nested')),
      paragraph(text('After')),
    ])
  })

  test('leaves valid documents exactly as they are', ({ assert }) => {
    const document = {
      type: 'doc',
      content: [
        paragraph(text('Cited.'), citation),
        { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('One'))] }] },
        { type: 'paragraph' },
        { type: 'image', attrs: { sourceChunkId: 'chunk-2' } },
      ],
    }
    assert.deepEqual(repair(structuredClone(document)), document)
  })

  test('leaves user-typed rich text strict unless repair is requested', ({ assert }) => {
    const nested = { type: 'doc', content: [paragraph(paragraph(text('Nested')))] }
    assert.deepEqual(new ContentService().normalize(structuredClone(nested)), nested)
  })
})
