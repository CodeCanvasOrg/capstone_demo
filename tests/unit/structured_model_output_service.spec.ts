import { test } from '@japa/runner'

import { getInitPrompt, getStructuredOutput } from '#services/structured_model_output_service'

const VALID_DOC = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Quarterly Strategy' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Launch fast', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' everywhere', marks: [{ type: 'underline' }] },
      ],
    },
    {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
    },
  ],
}

test.group('StructuredModelOutputService | getStructuredOutput', () => {
  test('accepts a valid TipTap document', ({ assert }) => {
    const schema = getStructuredOutput()
    const parsed = schema.safeParse(VALID_DOC)

    assert.isTrue(parsed.success)
    assert.deepEqual(parsed.data, VALID_DOC)
  })

  test('rejects a document that is not wrapped in a "doc" node', ({ assert }) => {
    const schema = getStructuredOutput()
    const parsed = schema.safeParse({ type: 'text', text: 'not a document' })

    assert.isFalse(parsed.success)
  })

  test('rejects heading levels outside the 1-6 range', ({ assert }) => {
    const schema = getStructuredOutput()
    const parsed = schema.safeParse({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 7 }, content: [{ type: 'text', text: 'x' }] }],
    })

    assert.isFalse(parsed.success)
  })

  test('accepts ordered lists and horizontal rules supported by the editor', ({ assert }) => {
    const schema = getStructuredOutput()
    const parsed = schema.safeParse({
      type: 'doc',
      content: [
        { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
        { type: 'horizontalRule' },
      ],
    })

    assert.isTrue(parsed.success)
  })

  test('accepts image and source citation nodes with a source chunk ID', ({ assert }) => {
    const schema = getStructuredOutput()
    const parsed = schema.safeParse({
      type: 'doc',
      content: [
        { type: 'image', attrs: { sourceChunkId: 'image-chunk-1', alt: 'Product diagram' } },
        { type: 'sourceCitation', attrs: { sourceChunkId: 'text-chunk-2' } },
      ],
    })

    assert.isTrue(parsed.success)
    assert.deepEqual(parsed.data, {
      type: 'doc',
      content: [
        { type: 'image', attrs: { sourceChunkId: 'image-chunk-1', alt: 'Product diagram' } },
        { type: 'sourceCitation', attrs: { sourceChunkId: 'text-chunk-2' } },
      ],
    })
  })

  test('rejects unsupported node types', ({ assert }) => {
    const schema = getStructuredOutput()
    const parsed = schema.safeParse({ type: 'doc', content: [{ type: 'table' }] })

    assert.isFalse(parsed.success)
  })

  test('supports valid inline marks', ({ assert }) => {
    const schema = getStructuredOutput()
    const parsed = schema.safeParse({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'linked',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
          ],
        },
      ],
    })

    assert.isTrue(parsed.success)
  })

  test('rejects unknown mark types', ({ assert }) => {
    const schema = getStructuredOutput()
    const parsed = schema.safeParse({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [{ type: 'highlight' }] }],
        },
      ],
    })

    assert.isFalse(parsed.success)
  })
})

test.group('StructuredModelOutputService | getInitPrompt', () => {
  test('renders the title and description into the prompt messages', async ({ assert }) => {
    const prompt = getInitPrompt()
    const value = await prompt.invoke({
      title: 'Marketing Plan',
      description: 'Launch strategy',
      context: 'Source material',
    })
    const rendered = value.messages.map((message) => String(message.content)).join('\n')

    assert.include(rendered, 'Marketing Plan')
    assert.include(rendered, 'Launch strategy')
    assert.include(rendered, 'Source material')
    assert.include(rendered, 'sourceCitation')
    assert.include(rendered, 'sourceChunkId')
  })
})
