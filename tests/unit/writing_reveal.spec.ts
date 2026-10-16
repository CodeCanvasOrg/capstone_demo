import { test } from '@japa/runner'
import { Schema } from '@tiptap/pm/model'
import { writingReveal } from '../../shared/writing_reveal.ts'
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } } },
    bulletList: { content: 'listItem+', group: 'block' },
    listItem: { content: 'paragraph block*' },
    image: { group: 'block', atom: true, attrs: { src: {} } },
    sourceCitation: { group: 'inline', inline: true, atom: true, attrs: { sourceChunkId: {} } },
    text: { group: 'inline' },
  },
  marks: { bold: {}, italic: {} },
})
test.group('Document writing reveal', () => {
  test('prefixes preserve nested formatting, Unicode and atomic evidence; completion is exact', ({
    assert,
  }) => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'A story 🐝', marks: [{ type: 'bold' }] }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Verified evidence ' },
            { type: 'sourceCitation', attrs: { sourceChunkId: 'trusted-chunk' } },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Results', marks: [{ type: 'italic' }] }],
                },
              ],
            },
          ],
        },
        { type: 'image', attrs: { src: '/authorized/image' } },
      ],
    }
    const doc = schema.nodeFromJSON(json)
    for (let i = 1; i <= doc.content.size; i++) {
      const frame = schema.nodeFromJSON(writingReveal(doc, i / doc.content.size))
      frame.check()
      assert.isFalse(/[\uD800-\uDBFF]$/.test(frame.textContent))
      frame.descendants((node) => {
        if (node.type.name === 'image') assert.equal(node.attrs.src, '/authorized/image')
        if (node.type.name === 'sourceCitation')
          assert.equal(node.attrs.sourceChunkId, 'trusted-chunk')
      })
    }
    assert.deepEqual(writingReveal(doc, 1), doc.toJSON())
    assert.deepEqual(writingReveal(doc, 2), doc.toJSON())
  })
})
