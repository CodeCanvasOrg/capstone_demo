import { test } from '@japa/runner'
import { OutputParserException } from '@langchain/core/output_parsers'
import OpenRouterService from '#services/open_router_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'

type Edits = { edits: unknown[]; summary: string }
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const cited = {
  type: 'paragraph',
  content: [
    { type: 'text', text: 'Cited claim.' },
    { type: 'sourceCitation', attrs: { sourceChunkId: 'chunk-1' } },
  ],
}
const original = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
    paragraph('Intro.'),
    cited,
    paragraph('Results.'),
  ],
} as TipTapDocument

function service(result: Edits) {
  const instance = new OpenRouterService()
  const seen: { input?: unknown } = {}
  Object.assign(instance, {
    runGeneration: async (_chain: unknown, input: unknown) => {
      seen.input = input
      return result
    },
  })
  return { instance, seen }
}

test.group('OpenRouterService.reviseDocument', () => {
  test('applies only the named block edits and keeps every other block identical', async ({
    assert,
  }) => {
    const { instance, seen } = service({
      edits: [
        { action: 'replace', index: 1, content: [paragraph('Shorter intro.')] },
        { action: 'insert_after', index: 3, content: [paragraph('Next steps.')] },
        { action: 'insert_after', index: -1, content: [paragraph('Note.')] },
      ],
      summary: 'Shortened the intro and added next steps.',
    })
    const result = await instance.reviseDocument(original, 'Shorten the intro, add next steps')
    assert.deepEqual(result.document.content, [
      paragraph('Note.'),
      original.content[0],
      paragraph('Shorter intro.'),
      cited,
      paragraph('Results.'),
      paragraph('Next steps.'),
    ])
    assert.strictEqual(result.document.content[3], cited)
    assert.isTrue(result.changed)
    assert.include(JSON.stringify(seen.input), 'Shorten the intro, add next steps')
  })

  test('deletes blocks and reports no change when the model returns no edits', async ({
    assert,
  }) => {
    const deleted = await service({
      edits: [{ action: 'delete', index: 3 }],
      summary: 'Removed results.',
    }).instance.reviseDocument(original, 'Remove the results')
    assert.deepEqual(deleted.document.content, original.content.slice(0, 3))
    const unchanged = await service({ edits: [], summary: '' }).instance.reviseDocument(
      original,
      'Looks good'
    )
    assert.isFalse(unchanged.changed)
    assert.deepEqual(unchanged.document, original)
  })

  test('rejects conflicting or out-of-range edits instead of guessing', async ({ assert }) => {
    for (const edits of [
      [
        { action: 'replace', index: 1, content: [paragraph('A')] },
        { action: 'delete', index: 1 },
      ],
      [{ action: 'delete', index: -1 }],
      [{ action: 'replace', index: 9, content: [paragraph('A')] }],
      [{ action: 'replace', index: 1 }],
    ])
      await assert.rejects(
        () => service({ edits, summary: '' }).instance.reviseDocument(original, 'Edit'),
        /conflicting edits/
      )
  })

  test('retries once the model returns output that fails its schema', async ({ assert }) => {
    const instance = new OpenRouterService()
    let calls = 0
    Object.assign(instance, {
      runGeneration: async () => {
        if (++calls === 1) throw new OutputParserException('Failed to parse')
        return { edits: [{ action: 'delete', index: 3 }], summary: 'Removed results.' }
      },
    })
    const result = await instance.reviseDocument(original, 'Remove the results')
    assert.equal(calls, 2)
    assert.deepEqual(result.document.content, original.content.slice(0, 3))
  })

  test('does not retry provider failures that are not about the output', async ({ assert }) => {
    const instance = new OpenRouterService()
    let calls = 0
    Object.assign(instance, {
      runGeneration: async () => {
        calls++
        throw Object.assign(new Error('Unauthorized'), { status: 401 })
      },
    })
    await assert.rejects(() => instance.reviseDocument(original, 'Edit'), /Unauthorized/)
    assert.equal(calls, 1)
  })
})
