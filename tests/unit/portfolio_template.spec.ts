import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import ContentService from '#services/documents/content_service'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import { projectionDocument } from '#services/exports/canvas_renderer'
import {
  parseCanvas,
  walkNodes,
  type CanvasDocument,
  type Frame,
  type TextFrame,
} from '../../shared/canvas/model.ts'
import { citationNumbers } from '../../shared/canvas/portfolio/citations.ts'
import {
  composePortfolio,
  frameIdFor,
  locatorOf,
  pagePlan,
  representatives,
  titleLines,
  type EntryInput,
  type PortfolioInput,
  type SourceInfo,
} from '../../shared/canvas/portfolio/compose.ts'
import { SAMPLE } from '../../shared/canvas/portfolio/sample.ts'
import {
  ENTRY,
  PT,
  ROW_HEIGHTS_8,
  ROW_LINES_8,
  figureCells,
  pt,
  rowHeights,
  rowLines,
} from '../../shared/canvas/portfolio/tokens.ts'

type Tokens = {
  pages: {
    name: string
    slots: { name: string; box_pt: { x: number; y: number; w: number; h: number } }[]
  }[]
}
const tokens = async (): Promise<Tokens> =>
  JSON.parse(await readFile(app.makePath('docs/design/portfolio-template/tokens.json'), 'utf8'))

const textOf = (frame: Frame) => {
  const parts: string[] = []
  if (frame.kind === 'text')
    walkNodes(frame.doc, (n) => {
      if (n.type === 'text') parts.push(String((n as { text?: unknown }).text))
    })
  return parts.join('')
}
const frame = (canvas: CanvasDocument, sheet: number, slot: string) =>
  canvas.sheets[sheet].frames.find((f) => f.id === frameIdFor(canvas.sheets[sheet].id, slot))

const sample = () => composePortfolio(SAMPLE)
/** The sample with its single entry changed. */
const withEntry = (change: (entry: EntryInput) => EntryInput, input: PortfolioInput = SAMPLE) =>
  composePortfolio({ ...input, entries: input.entries.map(change) })

test.group('portfolio template: tokens', () => {
  test('the point unit converts to tenths of a millimetre', ({ assert }) => {
    assert.approximately(PT, 3.5278, 0.0001)
    assert.equal(pt(595.2756), 2100)
    assert.equal(pt(841.8898), 2970)
  })

  test('every text slot of tokens.json has a frame at that slot’s position', async ({ assert }) => {
    const canvas = sample()
    const sheetOf: Record<string, number> = { cover: 0, entry: 1, sources: 2 }
    const inset = (name: string) =>
      name.endsWith('.section_number')
        ? 0
        : name.includes('.headers.')
          ? 6
          : name.includes('.evidence.rows.')
            ? 9
            : 0
    let checked = 0
    const { pages: designs } = await tokens()
    for (const design of designs)
      for (const slot of design.slots) {
        if (/\.citation$/.test(slot.name) || slot.name.endsWith('.page_counter')) continue
        if (/references\.\d\.number$/.test(slot.name)) continue
        const found =
          slot.name === 'entry.figure'
            ? frame(canvas, sheetOf[design.name], 'figure')
            : frame(canvas, sheetOf[design.name], slot.name)
        assert.exists(found, slot.name)
        // One canvas unit is 0.28 pt; the label of a section and the pill sit a line apart by design.
        const tolerance = slot.name.endsWith('section_label') ? 1 : 0.3
        assert.approximately(found!.geo.x / PT, slot.box_pt.x, tolerance, `${slot.name} x`)
        assert.approximately(
          found!.geo.y / PT,
          slot.box_pt.y + inset(slot.name),
          1,
          `${slot.name} y`
        )
        checked++
      }
    assert.isAbove(checked, 60)
  })

  test('an eight-row entry uses the design’s own row budgets and heights', ({ assert }) => {
    assert.deepEqual(rowLines(8), [...ROW_LINES_8])
    assert.deepEqual(rowHeights(8), [...ROW_HEIGHTS_8])
    assert.equal(207 + ROW_HEIGHTS_8.reduce((a, b) => a + b, 0), 612.75)
    // Fewer rows have room for three lines each.
    assert.deepEqual(rowLines(5), [3, 3, 3, 3, 3])
    assert.isTrue(rowHeights(5).every((h) => h === 66))
  })

  test('figure cells fill the frame for one to four pictures without overlap', ({ assert }) => {
    for (const n of [1, 2, 3, 4]) {
      const cells = figureCells(n)
      assert.lengthOf(cells, n)
      for (const c of cells) {
        assert.isAtLeast(c.x, 0)
        assert.isAtMost(c.x + c.w, ENTRY.figure.w)
        assert.isAtMost(c.y + c.h, ENTRY.figure.h)
      }
      cells.forEach((a, i) =>
        cells.slice(i + 1).forEach((b) => {
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
          assert.isTrue(apart, `cells ${i} overlap at ${n}`)
        })
      )
    }
    assert.deepEqual(figureCells(9), figureCells(4))
  })
})

test.group('portfolio template: composer', () => {
  test('the sample is a valid canvas of three sheets with the template marker', ({ assert }) => {
    const canvas = sample()
    const parsed = parseCanvas(canvas)
    assert.isTrue(parsed.ok, JSON.stringify(parsed.ok ? [] : parsed.problems))
    assert.lengthOf(canvas.sheets, 3)
    assert.deepEqual(canvas.template, { id: 'portfolio', version: 1 })
    assert.deepEqual(
      canvas.sheets.map((s) => s.background),
      ['surface', 'white', 'white']
    )
    // Frame ids are slot names: a frame can be traced to the design.
    assert.exists(frame(canvas, 1, 'entry.rows.3.body'))
    assert.match(frame(canvas, 1, 'entry.rows.3.body')!.id, /^s1-entry-rows-3-body$/)
  })

  test('the cover has the navy block, the hexagons and three composed title lines', ({
    assert,
  }) => {
    const cover = sample().sheets[0]
    const navy = cover.frames.find((f) => f.id === 's0-navy')!
    assert.equal(navy.kind, 'shape')
    assert.approximately(navy.geo.h / PT, 666, 0.2)
    assert.exists(cover.frames.find((f) => f.kind === 'art' && f.art === 'hexagons'))
    assert.equal(textOf(frame(sample(), 0, 'cover.eyebrow')!), 'Selected project portfolio')
    const lines = titleLines('Designing the next chapter of public services')
    assert.lengthOf(lines, 3)
    assert.deepEqual(titleLines('a\nb'), ['a', 'b'])
  })

  test('a cover fact without a value is dropped and the others keep their places', ({ assert }) => {
    const meta = SAMPLE.cover.meta.map((m, i) =>
      i === 1 ? { ...m, value: '', secondary: 'x' } : m
    )
    const canvas = composePortfolio({ ...SAMPLE, cover: { ...SAMPLE.cover, meta } })
    assert.isUndefined(frame(canvas, 0, 'cover.meta.2.label'))
    assert.isUndefined(frame(canvas, 0, 'cover.meta.2.secondary'))
    const before = frame(sample(), 0, 'cover.meta.3.value')!
    assert.deepEqual(frame(canvas, 0, 'cover.meta.3.value')!.geo, before.geo)
  })

  test('the second line of a two-line cover value pushes its secondary line down', ({ assert }) => {
    const canvas = sample()
    const one = frame(canvas, 0, 'cover.meta.2.secondary')!
    const two = frame(canvas, 0, 'cover.meta.1.secondary')!
    assert.approximately((two.geo.y - one.geo.y) / PT, 13.5, 0.3)
  })

  test('rows with nothing to say are dropped with their separator, and the rest move up', ({
    assert,
  }) => {
    const full = sample()
    const dropped = withEntry((entry) => ({
      ...entry,
      page: {
        ...entry.page,
        rows: entry.page.rows.map((row, i) => (i === 3 || i === 6 ? { ...row, body: '' } : row)),
      },
    }))
    const rows = dropped.sheets[1].frames.filter((f) => /-entry-rows-\d+-body$/.test(f.id))
    assert.lengthOf(rows, 6)
    assert.isUndefined(frame(dropped, 1, 'entry.rows.7.body'))
    assert.lengthOf(
      dropped.sheets[1].frames.filter((f) => /-sep-\d+$/.test(f.id)),
      6
    )
    // Six rows have three lines each and start where the first row of the full entry did.
    assert.equal(
      frame(dropped, 1, 'entry.rows.1.label')!.geo.y,
      frame(full, 1, 'entry.rows.1.label')!.geo.y
    )
    const second =
      frame(dropped, 1, 'entry.rows.2.label')!.geo.y -
      frame(dropped, 1, 'entry.rows.1.label')!.geo.y
    assert.approximately(second / PT, 66, 0.4)
    // The dropped rows' labels are never printed.
    const printed = dropped.sheets[1].frames.map(textOf).join(' ')
    assert.notInclude(printed, 'Approach')
    assert.notInclude(printed, 'Evidence')
  })

  test('without pictures the rows use the whole width; with pictures the figure frame holds them', ({
    assert,
  }) => {
    const wide = withEntry((entry) => ({ ...entry, sampleFigure: false }))
    assert.approximately(frame(wide, 1, 'entry.rows.1.body')!.geo.w / PT, 493.5, 0.3)
    assert.isUndefined(frame(wide, 1, 'figure'))
    const pictured = withEntry((entry) => ({
      ...entry,
      sampleFigure: false,
      images: [0, 1, 2].map((i) => ({
        imageId: `00000000-0000-4000-8000-00000000000${i}`,
        alt: `Picture ${i}`,
      })),
    }))
    assert.exists(frame(pictured, 1, 'figure'))
    const images = pictured.sheets[1].frames.filter((f) => f.kind === 'image')
    assert.lengthOf(images, 3)
    for (const image of images) {
      assert.equal(image.kind === 'image' && image.fit, 'contain')
      assert.isAtLeast(image.geo.x, frame(pictured, 1, 'figure')!.geo.x)
    }
    assert.approximately(frame(pictured, 1, 'entry.rows.1.body')!.geo.w / PT, 260.25, 0.3)
  })

  test('the constraint is bold text, and a row cites one footnote per source document', ({
    assert,
  }) => {
    const canvas = sample()
    const challenge = frame(canvas, 1, 'entry.rows.3.body') as TextFrame
    const para = challenge.doc[0] as {
      content: { type: string; text?: string; marks?: unknown[] }[]
    }
    assert.deepEqual(para.content[0].marks, [{ type: 'bold' }])
    assert.equal(para.content[0].text, 'Incomplete intake led to repeat contact.')
    assert.equal(challenge.style.strongColor, '#b23a3a')
    // Solution cites two chunks of one document: one footnote.
    const solution = frame(canvas, 1, 'entry.rows.5.body') as TextFrame
    const marks: string[] = []
    walkNodes(solution.doc, (n) => {
      if (n.type === 'sourceCitation') marks.push(String(n.attrs?.sourceChunkId))
    })
    assert.lengthOf(marks, 1)
  })

  test('footnotes are numbered by document, the way the sample’s superscripts are', ({
    assert,
  }) => {
    const numbers = citationNumbers(sample())
    assert.equal(numbers.size, 4)
    assert.deepEqual([...numbers.values()], [1, 2, 3, 4])
    const reps = representatives(SAMPLE.entries, SAMPLE.sources)
    assert.equal(numbers.get(reps.get('Discovery research summary')!), 1)
    assert.equal(numbers.get(reps.get('Moderated usability study')!), 3)
  })

  test('the numbers the composer prints equal the numbers the export gives the superscripts', ({
    assert,
  }) => {
    const canvas = sample()
    const content = new ContentService().normalize(projectionDocument(canvas), { repair: true })
    const { client } = new PublicationProjectionService().project(content)
    const refs: number[] = []
    const walk = (nodes: { type: string; number?: number; content?: unknown[] }[]) => {
      for (const n of nodes) {
        if (n.type === 'reference' && n.number) refs.push(n.number)
        if (Array.isArray(n.content)) walk(n.content as never)
      }
    }
    walk(client.body as never)
    // 1, 1, 2, 3, 3, 4: the design's superscripts, row by row.
    assert.deepEqual(refs, [1, 1, 2, 3, 3, 4])
    const printed = canvas.sheets[2].frames
      .filter((f) => f.id.endsWith('-number'))
      .map((f) => Number(textOf(f)))
    assert.deepEqual(printed, [1, 2, 3, 4])
  })

  test('the sources page lists each cited document with its locator and note', ({ assert }) => {
    const canvas = sample()
    const doc = (n: number, part: string) =>
      textOf(frame(canvas, 2, `sources.references.${n}.${part}`)!)
    assert.equal(doc(1, 'document'), 'Discovery research summary')
    assert.equal(doc(1, 'locator'), 'Pages 3–7 · chunks R01–R06')
    assert.equal(doc(3, 'locator'), 'Pages 4–6 · sessions T01–T05')
    assert.equal(
      doc(2, 'note'),
      'Guided intake, shared queue and status history in the tested flow.'
    )
    assert.equal(textOf(frame(canvas, 2, 'sources.evidence.rows.2.2')!), '3 · pp. 4–6 / T01–T05')
  })

  test('a locator is built from the cited chunks only, with page and chunk ranges', ({
    assert,
  }) => {
    const infos: SourceInfo[] = [
      { fileName: 'a.pdf', pageNumber: 4, chunkIndex: 3 },
      { fileName: 'a.pdf', pageNumber: 9, chunkIndex: 11 },
    ]
    assert.deepEqual(locatorOf(infos), {
      locator: 'Pages 4–9 · chunks 4–12',
      short: 'pp. 4–9 / 4–12',
    })
    assert.equal(locatorOf([infos[0]]).locator, 'Page 4 · chunks 4')
    assert.equal(locatorOf([{ fileName: 'b.txt', chunkIndex: 0 }]).locator, 'Chunks 1')
  })

  test('the evidence table is dropped when the entry has no claims, and the note moves up', ({
    assert,
  }) => {
    const bare = withEntry((entry) => ({ ...entry, page: { ...entry.page, claims: [] } }))
    assert.isUndefined(frame(bare, 2, 'sources.evidence.title'))
    assert.isUndefined(frame(bare, 2, 'sources.evidence.rows.1.1'))
    const note = frame(bare, 2, 'sources.note.title')!
    const full = frame(sample(), 2, 'sources.note.title')!
    assert.isBelow(note.geo.y, full.geo.y)
    // With the table the note sits at the design's y = 672pt.
    assert.approximately(full.geo.y / PT, 672, 0.3)
  })

  test('more than four sources continue on another sources page with the same header and footer', ({
    assert,
  }) => {
    const infos = new Map(SAMPLE.sources)
    const rows = Array.from({ length: 6 }, (_, i) => {
      infos.set(`extra-${i}`, { fileName: `Extra document ${i}`, chunkIndex: i, pageNumber: i + 1 })
      return {
        label: `Row ${i}`,
        body: 'Something the document says about the work.',
        chunks: [`extra-${i}`],
      }
    })
    const canvas = composePortfolio({
      ...SAMPLE,
      sources: infos,
      entries: [{ page: { ...SAMPLE.entries[0].page, rows, claims: [] }, sampleFigure: false }],
    })
    // cover, entry, sources (4), sources (2)
    assert.lengthOf(canvas.sheets, 4)
    assert.deepEqual(
      pagePlan([{ page: { ...SAMPLE.entries[0].page, rows, claims: [] } }], infos),
      [3]
    )
    assert.include(textOf(frame(canvas, 3, 'sources.title')!), '(continued)')
    assert.isUndefined(frame(canvas, 3, 'sources.note.title'))
    assert.equal(textOf(frame(canvas, 3, 'sources.page_counter')!), '4 / 4')
    assert.equal(textOf(frame(canvas, 3, 'sources.references.1.number')!), '5')
  })

  test('the page counter counts every page, the cover included', ({ assert }) => {
    const canvas = sample()
    assert.equal(textOf(frame(canvas, 1, 'entry.page_counter')!), '2 / 3')
    assert.equal(textOf(frame(canvas, 2, 'sources.page_counter')!), '3 / 3')
  })

  test('two entries number footnotes across the whole portfolio, and every id stays unique', ({
    assert,
  }) => {
    const second: EntryInput = {
      ...SAMPLE.entries[0],
      page: {
        ...SAMPLE.entries[0].page,
        title: 'Entry 02',
        rows: SAMPLE.entries[0].page.rows.map((r) => ({
          ...r,
          chunks: r.chunks.length ? ['sample-t01'] : [],
        })),
      },
    }
    const canvas = composePortfolio({ ...SAMPLE, entries: [SAMPLE.entries[0], second] })
    assert.lengthOf(canvas.sheets, 5)
    assert.isTrue(parseCanvas(canvas).ok)
    // The second entry cites only the usability study, which is footnote 3 across the portfolio.
    const printed = canvas.sheets[4].frames
      .filter((f) => f.id.endsWith('-number'))
      .map((f) => textOf(f))
    assert.deepEqual(printed, ['3'])
    assert.equal(textOf(frame(canvas, 3, 'entry.section_number')!), '02')
  })
})
