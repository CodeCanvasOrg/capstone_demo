import { test } from '@japa/runner'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { documentFromAcademicPages } from '../../shared/canvas/academic/content.ts'
import {
  composeAcademic,
  composeAcademicSheet,
  type AcademicInput,
  type AcademicMeta,
} from '../../shared/canvas/academic/compose.ts'
import {
  ACADEMIC_DESIGN_IDS,
  FIXED_DESIGN_IDS,
  type AcademicDesignId,
} from '../../shared/canvas/academic/designs.ts'
import { deriveDocument } from '../../shared/canvas/derive.ts'
import { pageMetrics } from '../../shared/canvas/density.ts'
import { SHEET, parseCanvas, walkNodes } from '../../shared/canvas/model.ts'
import { IMAGE } from '../fixtures/canvas/index.ts'
import { samplePage } from '../fixtures/canvas/academic.ts'

const meta: AcademicMeta = {
  title: 'Cooling cities: evidence for heat mitigation',
  label: 'Academic report',
  date: '23 November 2026',
  keywords: ['urban heat', 'reflective roofs', 'canopy cover'],
  references: [
    { label: 'heat_study.pdf', pages: 'pp. 3, 5' },
    { label: 'pilot_districts.pdf', pages: 'p. 2' },
  ],
}
const image = {
  imageId: IMAGE,
  alt: 'Thermal map of a district',
  caption: 'Surface temperature before and after planting.',
  source: 'heat_study.pdf',
  focus: { x: 30, y: 60 },
}
const input = (design: AcademicDesignId): AcademicInput => ({
  design,
  ...(FIXED_DESIGN_IDS.includes(design as never) && design !== 'title_page'
    ? {}
    : { page: samplePage(design) }),
  image: ['figure_text', 'side_figure', 'title_page'].includes(design) ? image : null,
})

/** Words of every text node under blocks, as a sorted multiset. */
const wordsOf = (blocks: unknown[]) => {
  const out: string[] = []
  walkNodes(blocks, (node: any) => {
    if (node.type === 'text')
      out.push(
        ...String(node.text)
          .split(/\s+|—/)
          .filter(Boolean)
          .map((w) => w.replace(/[.,;:]$/, ''))
      )
  })
  return out.sort()
}
const contains = (all: string[], some: string[]) => {
  const bag = new Map<string, number>()
  for (const w of all) bag.set(w, (bag.get(w) ?? 0) + 1)
  return some.filter((w) => {
    const n = bag.get(w) ?? 0
    bag.set(w, n - 1)
    return n <= 0
  })
}

const SNAP = new URL('../fixtures/canvas/academic_snapshots/', import.meta.url)
const outline = (design: AcademicDesignId) =>
  composeAcademicSheet(input(design), 3, meta, {
    figure: 2,
    contents: [{ title: 'A', page: 3 }],
  }).frames.map((f) => `${f.id} ${f.kind} ${f.geo.x},${f.geo.y},${f.geo.w},${f.geo.h}`)

test.group('academic compose', () => {
  for (const design of ACADEMIC_DESIGN_IDS)
    test(`the ${design} design composes a valid sheet`, ({ assert }) => {
      const canvas = composeAcademic([input(design)], meta)
      const parsed = parseCanvas(canvas, { imageIds: new Set([IMAGE]) })
      assert.isTrue(parsed.ok, parsed.ok ? '' : JSON.stringify(parsed.problems.slice(0, 3)))
      const [sheet] = canvas.sheets
      assert.isAbove(sheet.frames.length, 2)
      for (const f of sheet.frames) {
        assert.isAtMost(f.geo.x + f.geo.w, SHEET.w, `${f.id} inside the sheet`)
        assert.isAtMost(f.geo.y + f.geo.h, SHEET.h, `${f.id} inside the sheet`)
      }
      assert.lengthOf(new Set(sheet.frames.map((f) => f.id)), sheet.frames.length)
    })

  for (const design of ACADEMIC_DESIGN_IDS.filter((d) => !FIXED_DESIGN_IDS.includes(d as never)))
    test(`nothing is dropped: every word of a ${design} page lands in a frame`, ({ assert }) => {
      const page = samplePage(design)
      const sheet = composeAcademicSheet(input(design), 1, meta)
      const placed = wordsOf([
        ...sheet.frames.flatMap((f) => (f.kind === 'text' ? f.doc : [])),
        // A figure card shows its value and label in a figure frame.
        ...sheet.frames.flatMap((f) =>
          f.kind === 'figure' ? [{ type: 'text', text: `${f.value} ${f.label}` }] : []
        ),
      ])
      const written = wordsOf(documentFromAcademicPages([page]).document.content)
      assert.deepEqual(contains(placed, written), [])
    })

  test('citations survive composition', ({ assert }) => {
    const canvas = composeAcademic([input('essay')], meta)
    let n = 0
    for (const sheet of canvas.sheets)
      for (const f of sheet.frames)
        if (f.kind === 'text')
          walkNodes(f.doc, (node: any) => {
            if (node.type === 'sourceCitation') n++
          })
    assert.isAtLeast(n, 3)
  })

  for (const design of ACADEMIC_DESIGN_IDS.filter((d) => !FIXED_DESIGN_IDS.includes(d as never)))
    test(`a ${design} page written to the target fills its layout`, ({ assert }) => {
      const sheet = composeAcademicSheet(input(design), 1, meta)
      const m = pageMetrics(sheet, 1)
      assert.equal(m.kind, 'content')
      assert.isAtLeast(m.fill ?? 0, 0.7, `${design} fill ${m.fill}`)
      assert.isAtMost(m.maxFrameFill ?? 0, 1.0, `${design} fullest frame ${m.maxFrameFill}`)
    })

  test('a case page may carry a small picture beside its narrative', ({ assert }) => {
    const canvas = composeAcademic(
      [{ design: 'case_box', page: samplePage('case_box'), image }],
      meta
    )
    assert.isTrue(parseCanvas(canvas, { imageIds: new Set([IMAGE]) }).ok)
    assert.exists(canvas.sheets[0].frames.find((f) => f.kind === 'image'))
    const body = canvas.sheets[0].frames.find((f) => f.id.endsWith('-body'))!
    assert.equal(body.geo.w, 1100)
  })

  test('the same input gives the same canvas', ({ assert }) => {
    const inputs = ACADEMIC_DESIGN_IDS.map(input)
    assert.deepEqual(composeAcademic(inputs, meta), composeAcademic(inputs, meta))
  })

  for (const design of ACADEMIC_DESIGN_IDS)
    test(`the ${design} layout has not changed`, ({ assert }) => {
      const file = new URL(`${design}.json`, SNAP)
      const now = `${JSON.stringify(outline(design), null, 2)}\n`
      if (process.env.UPDATE_SNAPSHOTS || !existsSync(file)) {
        mkdirSync(SNAP, { recursive: true })
        writeFileSync(file, now)
      }
      assert.equal(now, readFileSync(file, 'utf8'))
    })

  test('a figure page without a picture falls back to two columns, never an empty box', ({
    assert,
  }) => {
    const sheet = composeAcademicSheet(
      { design: 'figure_text', page: samplePage('figure_text'), image: null },
      1,
      meta
    )
    assert.notExists(sheet.frames.find((f) => f.kind === 'image'))
    assert.exists(sheet.frames.find((f) => f.id.endsWith('-col1')))
  })

  test('figure numbers follow the pages that show a picture; contents and folios agree', ({
    assert,
  }) => {
    const canvas = composeAcademic(
      [
        input('title_page'),
        { design: 'contents' },
        input('essay'),
        input('figure_text'),
        input('side_figure'),
        { design: 'references' },
      ],
      meta
    )
    const captions = canvas.sheets.flatMap((s) =>
      s.frames
        .filter((f) => f.id.endsWith('-cap') && f.kind === 'text')
        .map((f) => JSON.stringify(f.kind === 'text' ? f.doc : ''))
    )
    assert.match(captions[0], /Figure 1\. Surface temperature/)
    assert.match(captions[1], /Figure 2\./)
    const contents = canvas.sheets[1].frames.find((f) => f.id.endsWith('-nums'))
    assert.exists(contents)
    const text = JSON.stringify(contents)
    for (const page of [3, 4, 5, 6]) assert.include(text, `"${page}"`)
    for (const [i, sheet] of canvas.sheets.entries()) {
      const folio = sheet.frames.find((f) => f.id.endsWith('-folio'))
      if (i === 0) assert.notExists(folio)
      else assert.include(JSON.stringify(folio), `"${i + 1}"`)
    }
  })

  test('the derived text keeps the title as the document heading and one page break per sheet', ({
    assert,
  }) => {
    const canvas = composeAcademic([input('title_page'), input('essay'), input('conclusion')], meta)
    const doc = deriveDocument(canvas)
    assert.equal(doc.content.filter((b) => b.type === 'horizontalRule').length, 2)
    const headings = doc.content.filter((b) => b.type === 'heading')
    assert.equal((headings[0].attrs as { level: number }).level, 1)
  })

  test('references list every source in order', ({ assert }) => {
    const sheet = composeAcademicSheet({ design: 'references' }, 5, meta)
    const list = sheet.frames.find((f) => f.id.endsWith('-list'))
    const text = JSON.stringify(list)
    assert.isBelow(text.indexOf('heat_study.pdf'), text.indexOf('pilot_districts.pdf'))
  })
})
