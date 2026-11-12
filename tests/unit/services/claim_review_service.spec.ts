import { test } from '@japa/runner'
import { extractClaims } from '#services/documents/claim_review_service'

const cite = (id: string, text: string) => ({
  type: 'sourceCitation',
  attrs: { sourceChunkId: id, chunkText: text, fileName: 'report.pdf' },
})

test.group('extractClaims', () => {
  test('turns cited blocks into claims with their cited evidence', ({ assert }) => {
    const claims = extractClaims({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Uncited intro.' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Latency fell by up to 40%.' },
            cite('a', 'p95 dropped 38%'),
            cite('a', 'p95 dropped 38%'),
            cite('b', 'Median dropped 20%'),
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
                  content: [{ type: 'text', text: 'Cost halved.' }, cite('c', 'Cost fell 50%')],
                },
              ],
            },
          ],
        },
      ],
    })
    assert.lengthOf(claims, 2)
    assert.equal(claims[0].text, 'Latency fell by up to 40%.')
    assert.deepEqual(
      claims[0].evidence.map((item) => item.id),
      ['a', 'b']
    )
    assert.deepEqual(claims[0].fileNames, ['report.pdf'])
    assert.equal(claims[1].text, 'Cost halved.')
  })
})
