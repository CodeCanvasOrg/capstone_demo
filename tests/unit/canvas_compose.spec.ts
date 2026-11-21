import { test } from '@japa/runner'
import { DESIGN_IDS } from '../../shared/brochure/designs.ts'
import { composeCanvas, splitSheets } from '../../shared/canvas/compose.ts'
import { deriveDocument } from '../../shared/canvas/derive.ts'
import { parseCanvas, walkNodes } from '../../shared/canvas/model.ts'
import { hashOf } from '../../shared/layout/hash.ts'
import { samples } from '../fixtures/brochure/pages.ts'
import { CHUNK, allDesigns, maxDesigns, minimal, storedDoc } from '../fixtures/canvas/index.ts'

/** Every piece of text in a document, in any order, as a sorted multiset. */
const words = (doc: { content?: unknown[] }) => {
  const out: string[] = []
  walkNodes(doc.content ?? [], (node: any) => {
    if (node.type === 'text') out.push(...String(node.text).split(/\s+|—/).filter(Boolean))
  })
  return out.sort()
}
const citations = (doc: { content?: unknown[] }) => {
  let n = 0
  walkNodes(doc.content ?? [], (node: any) => {
    if (node.type === 'sourceCitation') n++
  })
  return n
}

test.group('canvas compose', () => {
  for (const design of DESIGN_IDS)
    test(`the ${design} design composes a valid sheet`, ({ assert }) => {
      const canvas = composeCanvas(storedDoc([samples[design]]), [design])
      const parsed = parseCanvas(canvas)
      assert.isTrue(parsed.ok, parsed.ok ? '' : JSON.stringify(parsed.problems))
      assert.lengthOf(canvas.sheets, 1)
      assert.isAbove(canvas.sheets[0].frames.length, 0)
    })

  test('one sheet per page, in order', ({ assert }) => {
    const { doc, designs } = allDesigns()
    const canvas = composeCanvas(doc, designs)
    assert.lengthOf(canvas.sheets, DESIGN_IDS.length)
    assert.deepEqual(
      canvas.sheets.map((s) => s.id),
      DESIGN_IDS.map((_, i) => `s${i}`)
    )
  })

  test('nothing is lost: every word of every page lands in a frame', ({ assert }) => {
    for (const fixture of [allDesigns(), maxDesigns()]) {
      const canvas = composeCanvas(fixture.doc, fixture.designs)
      assert.deepEqual(words(deriveDocument(canvas)), words(fixture.doc))
    }
  })

  test('filled-to-the-limit pages still compose valid canvases', ({ assert }) => {
    const { doc, designs } = maxDesigns()
    const parsed = parseCanvas(composeCanvas(doc, designs))
    assert.isTrue(parsed.ok, parsed.ok ? '' : JSON.stringify(parsed.problems.slice(0, 3)))
  })

  test('citations are moved into frames, never dropped', ({ assert }) => {
    const page = structuredClone(samples.article)
    page.sections[0].paragraphs[0].chunks = [CHUNK]
    const doc = storedDoc([page])
    assert.equal(citations(doc), 1)
    assert.equal(citations(deriveDocument(composeCanvas(doc, ['article']))), 1)
  })

  test('a figure with a citation stays text, so the citation survives', ({ assert }) => {
    const doc = {
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '83% — of executives' },
            { type: 'sourceCitation', attrs: { sourceChunkId: CHUNK } },
          ],
        },
      ],
    }
    const canvas = composeCanvas(doc, ['proof'])
    assert.notInclude(
      canvas.sheets[0].frames.map((f) => f.kind),
      'figure'
    )
    assert.equal(citations(deriveDocument(canvas)), 1)
  })

  test('section figures become figure frames in designs that show them', ({ assert }) => {
    const canvas = composeCanvas(storedDoc([samples.offer]), ['offer'])
    const figure = canvas.sheets[0].frames.find((f) => f.kind === 'figure')
    assert.exists(figure)
  })

  test('the same input always gives the same canvas', ({ assert }) => {
    const { doc, designs } = allDesigns()
    assert.equal(hashOf(composeCanvas(doc, designs)), hashOf(composeCanvas(doc, designs)))
  })

  test('pages without a design fall back to the article layout', ({ assert }) => {
    const doc = storedDoc([samples.article, samples.article])
    const canvas = composeCanvas(doc, ['article'])
    assert.lengthOf(canvas.sheets, 2)
    assert.isTrue(parseCanvas(canvas).ok)
  })

  test('an empty document still has one sheet', ({ assert }) => {
    assert.lengthOf(splitSheets({ content: [] }), 1)
    assert.lengthOf(composeCanvas({ content: [] }, []).sheets, 1)
  })
})

test.group('canvas derive', () => {
  test('sheets become pages, frames read in order', ({ assert }) => {
    const doc = deriveDocument(minimal())
    assert.deepEqual(
      doc.content.map((n) => n.type),
      ['heading', 'paragraph', 'paragraph', 'horizontalRule', 'image', 'paragraph']
    )
    // The figure uses the "value — label" convention of text-only brochures.
    assert.equal((doc.content[2] as any).content[0].text, '83% — of executives')
    assert.equal(
      (doc.content[4] as any).attrs.documentImageId,
      (minimal().sheets[1].frames[0] as any).imageId
    )
  })

  test('the order field wins over position', ({ assert }) => {
    const canvas = minimal()
    canvas.sheets[0].frames[0].order = 5
    const doc = deriveDocument(canvas)
    assert.equal(doc.content[0].type, 'paragraph')
  })

  test('metadata on the document is kept', ({ assert }) => {
    const attrs = { publication: { schemaVersion: 1 } }
    assert.deepEqual(deriveDocument(minimal(), attrs).attrs, attrs)
  })
})
