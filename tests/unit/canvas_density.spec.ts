import { test } from '@japa/runner'
import {
  densityReport,
  overlap,
  pageKind,
  pageMetrics,
  pageProblems,
  DEFAULT_THRESHOLDS,
} from '../../shared/canvas/density.ts'
import {
  CANVAS_SCHEMA_VERSION,
  type CanvasDocument,
  type Sheet,
} from '../../shared/canvas/model.ts'
import { PLACEHOLDER } from '../../shared/brochure/content.ts'
import { CHUNK, IMAGE, minimal } from '../fixtures/canvas/index.ts'
import { PROSE } from '../fixtures/canvas/prose.ts'

const paragraphs = (texts: string[], cited = false) =>
  texts.map((value, i) => ({
    type: 'paragraph',
    content: [
      { type: 'text', text: value },
      ...(cited && i === 0 ? [{ type: 'sourceCitation', attrs: { sourceChunkId: CHUNK } }] : []),
    ],
  }))

const textFrame = (
  id: string,
  geo: { x: number; y: number; w: number; h: number },
  doc: unknown[]
) => ({
  id,
  kind: 'text',
  geo,
  z: 1,
  order: 0,
  style: {},
  doc,
})

const sheetOf = (id: string, frames: unknown[]) =>
  ({ id, background: 'white', frames }) as unknown as Sheet

const TITLE_GEO = { x: 200, y: 200, w: 1700, h: 300 }
const BODY_GEO = { x: 200, y: 600, w: 1700, h: 2000 }

/** A content page: a title and a flowing body, cited or not. */
const contentSheet = (id: string, texts: string[], cited = true) =>
  sheetOf(id, [
    textFrame(`${id}-ttl`, TITLE_GEO, paragraphs(['Heading'])),
    textFrame(`${id}-body`, BODY_GEO, paragraphs(texts, cited)),
  ])

// The density report still measures saved canvases made before the portfolio template
// (`canvas:density`); portfolio canvases use `portfolioReport`.
test.group('canvas density', () => {
  test('image resolution comes from the pixel size and the frame', ({ assert }) => {
    const sheet = minimal().sheets[1]
    const sharp = pageMetrics(sheet, 2, {
      images: new Map([[IMAGE, { width: 2400, height: 1600 }]]),
    })
    assert.isAtLeast(sharp.images[0].dpi ?? 0, 300)
    assert.equal(sharp.lowDpiImages, 0)
    const soft = pageMetrics(sheet, 2, { images: new Map([[IMAGE, { width: 600, height: 400 }]]) })
    assert.isBelow(soft.images[0].dpi ?? 999, 200)
    assert.equal(soft.lowDpiImages, 1)
    // An image whose size is unknown is not guessed at.
    assert.isNull(pageMetrics(sheet, 2).images[0].dpi)
  })

  test('citations are counted', ({ assert }) => {
    assert.equal(pageMetrics(minimal().sheets[0], 1).citations, 1)
  })

  test('the document report totals its pages', ({ assert }) => {
    const report = densityReport(minimal())
    assert.equal(report.pages.length, 2)
    assert.equal(report.words, report.pages[0].words + report.pages[1].words)
    assert.equal(report.citations, 1)
  })

  test('phrase overlap finds repeated pages and ignores different ones', ({ assert }) => {
    assert.isAbove(overlap(PROSE[0], PROSE[0]), 0.9)
    assert.isBelow(
      overlap(PROSE[0], 'Quite different words appear here and nothing is repeated at all today'),
      0.05
    )
    assert.equal(overlap('', PROSE[1]), 0)
  })

  test('pageKind reads the roles of the frames', ({ assert }) => {
    assert.equal(pageKind(sheetOf('s0', [textFrame('s0-band', TITLE_GEO, [])])), 'title')
    assert.equal(pageKind(sheetOf('s0', [textFrame('s0-titles', TITLE_GEO, [])])), 'contents')
    assert.equal(pageKind(sheetOf('s0', [textFrame('s0-list', TITLE_GEO, [])])), 'references')
    assert.equal(pageKind(contentSheet('s0', [PROSE[0]])), 'content')
    assert.equal(pageKind(sheetOf('s0', [textFrame('s0-f0', TITLE_GEO, [])])), 'other')
  })

  test('pageProblems reports a nearly empty body as fill', ({ assert }) => {
    const page = pageMetrics(contentSheet('s0', ['A short note.']), 0)
    assert.include(
      pageProblems(page, { ...DEFAULT_THRESHOLDS, minWords: 0, minCitations: 0 }).map(
        (p) => p.code
      ),
      'fill'
    )
  })

  test('pageProblems reports words when minWords is above the page', ({ assert }) => {
    const page = pageMetrics(contentSheet('s0', PROSE.slice(0, 2)), 0)
    const codes = (minWords: number) =>
      pageProblems(page, { minWords, minFill: 0, minCitations: 0 }).map((p) => p.code)
    assert.include(codes(page.words + 1), 'words')
    assert.notInclude(codes(page.words), 'words')
  })

  test('pageProblems reports overflow for text far over its frame', ({ assert }) => {
    const sheet = sheetOf('s0', [
      textFrame('s0-ttl', TITLE_GEO, paragraphs(['Heading'])),
      textFrame('s0-body', { x: 200, y: 600, w: 400, h: 200 }, paragraphs(PROSE, true)),
    ])
    const page = pageMetrics(sheet, 0)
    assert.isAbove(page.maxFrameFill ?? 0, 1)
    assert.include(
      pageProblems(page, { minWords: 0, minFill: 0, minCitations: 0 }).map((p) => p.code),
      'overflow'
    )
  })

  test('pageProblems reports citations and placeholders for an uncited placeholder body', ({
    assert,
  }) => {
    const page = pageMetrics(contentSheet('s0', [PLACEHOLDER], false), 0)
    const codes = pageProblems(page).map((p) => p.code)
    assert.include(codes, 'citations')
    assert.include(codes, 'placeholders')
  })

  test('pageProblems reports dpi for the 600x400 image', ({ assert }) => {
    const sheet = sheetOf('s0', [
      textFrame('s0-ttl', TITLE_GEO, paragraphs(['Heading'])),
      textFrame('s0-body', BODY_GEO, paragraphs(PROSE, true)),
      {
        id: 's0-pic',
        kind: 'image',
        geo: { x: 200, y: 200, w: 1000, h: 800 },
        z: 2,
        order: 2,
        style: {},
        imageId: IMAGE,
        alt: 'A scanner',
        fit: 'cover',
      },
    ])
    const page = pageMetrics(sheet, 0, {
      images: new Map([[IMAGE, { width: 600, height: 400 }]]),
    })
    assert.include(
      pageProblems(page).map((p) => p.code),
      'dpi'
    )
  })

  test('title, contents and references pages produce no problems', ({ assert }) => {
    for (const role of ['band', 'titles', 'list']) {
      const sheet = sheetOf('s0', [
        textFrame(`s0-${role}`, TITLE_GEO, paragraphs(['Heading'])),
        textFrame('s0-body', BODY_GEO, paragraphs([PLACEHOLDER])),
      ])
      assert.deepEqual(pageProblems(pageMetrics(sheet, 0)), [], role)
    }
  })

  test('densityReport finds a page that repeats an earlier page', ({ assert }) => {
    const report = densityReport({
      schemaVersion: CANVAS_SCHEMA_VERSION,
      sheets: [contentSheet('s0', [PROSE[0]]), contentSheet('s1', [PROSE[0]])],
    } as CanvasDocument)
    assert.isAbove(report.maxOverlap, 0.15)
  })
})
