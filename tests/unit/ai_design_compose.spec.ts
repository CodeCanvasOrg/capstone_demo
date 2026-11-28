import { test } from '@japa/runner'
import { parseCanvas, walkNodes, type TextFrame } from '../../shared/canvas/model.ts'
import { citationNumbers } from '../../shared/canvas/portfolio/citations.ts'
import type { SourceInfo } from '../../shared/canvas/portfolio/compose.ts'
import {
  canvasColor,
  composeAiDesign,
  type PageInput,
} from '../../shared/canvas/ai_design/compose.ts'
import { normalizeDesign } from '../../shared/canvas/ai_design/normalize.ts'
import { cleanFrameText, frameProblems, trimToFrame } from '../../shared/canvas/ai_design/fit.ts'
import { fitsFrame, measureText, resolveText } from '../../shared/canvas/ai_design/style.ts'
import { lineCount } from '../../shared/canvas/portfolio/measure.ts'
import {
  assignPictures,
  fitFor,
  wordOverlap,
  type Picture,
} from '../../app/services/canvas/ai_design/ai_design_images.ts'
import { sampleDesign, PALETTE } from '../helpers/ai_design.ts'

const sources = new Map<string, SourceInfo>([
  ['c1', { fileName: 'Research summary 1.pdf', pageNumber: 2, chunkIndex: 0 }],
  ['c2', { fileName: 'Research summary 1.pdf', pageNumber: 4, chunkIndex: 1 }],
  ['c3', { fileName: 'Field notes.pdf', pageNumber: 1, chunkIndex: 0 }],
])
const image = '11111111-1111-4111-8111-111111111111'

function inputs(n = 3): PageInput[] {
  const { design } = normalizeDesign(sampleDesign(n))
  return design.pages.map((page, i) => ({
    page,
    texts: new Map(
      page.frames
        .filter((f) => f.kind === 'text')
        .map((f) => [
          f.id,
          {
            text: i === 0 ? `Title ${f.id}` : `Para one of ${f.id}.\nPara two of ${f.id}.`,
            chunks: f.role === 'body' ? (i === 2 ? ['c1', 'c2'] : ['c3', 'c1']) : [],
          },
        ])
    ),
    pictures: new Map(
      page.frames
        .filter((f) => f.kind === 'image')
        .map((f) => [f.id, { imageId: image, alt: 'A district', fit: 'cover' as const }])
    ),
    claims:
      i === 1
        ? [{ claim: 'Surface temperatures fell', frame: 'body', kind: 'measured' as const }]
        : [],
  }))
}

const texts = (frame: TextFrame) => {
  const parts: string[] = []
  walkNodes(frame.doc, (n) => {
    if (n.type === 'text') parts.push(String((n as { text?: string }).text))
  })
  return parts.join(' ')
}

const compose = (pages = inputs(), extra = {}) =>
  composeAiDesign({
    system: sampleDesign().system,
    pages,
    sources,
    footer: 'Cooling the city',
    brand: { primary: '#14213d', accent: '#f2a900' },
    ...extra,
  })

test.group('AI design: compose', () => {
  test('the canvas carries the ai_design marker and is a valid canvas', ({ assert }) => {
    const { canvas } = compose()
    assert.deepEqual(canvas.template, { id: 'ai_design', version: 1 })
    const parsed = parseCanvas(canvas)
    assert.isTrue(parsed.ok, parsed.ok ? '' : JSON.stringify(parsed.problems))
    // Three designed pages, then the sources page.
    assert.equal(canvas.sheets.length, 4)
    assert.equal(canvas.sheets[0].id, 's0')
    assert.isTrue(canvas.sheets[1].frames.every((f) => f.id.startsWith('s1-')))
  })

  test('geometry, stacking and reading order follow the design', ({ assert }) => {
    const { canvas } = compose()
    const sheet = canvas.sheets[1]
    const heading = sheet.frames.find((f) => f.id === 's1-heading')!
    assert.deepInclude(heading.geo, { x: 200, y: 200, w: 1700, h: 300 })
    const z = sheet.frames.map((f) => f.z)
    assert.deepEqual(
      z,
      [...z].sort((a, b) => a - b)
    )
    const ordered = [...sheet.frames].sort((a, b) => a.order - b.order)
    assert.equal(ordered[0].id, 's1-heading')
    // Colours the brand has become brand references, the rest hex.
    assert.equal(canvasColor('primary', { palette: PALETTE }, { primary: '#14213d' }), 'primary')
    assert.equal(canvasColor('muted', { palette: PALETTE }, { primary: '#14213d' }), '#4b5563')
    assert.equal(canvas.sheets[0].frames[0].style.fill, 'primary')
    assert.equal(canvas.sheets[0].background, '#f6f4ee')
  })

  test('text frames carry exact type, only the shipped families, and paragraphs', ({ assert }) => {
    const { canvas } = compose()
    const body = canvas.sheets[1].frames.find((f) => f.id === 's1-body') as TextFrame
    assert.deepInclude(body.style, { size: 9.5, family: 'sans', weight: 400 })
    assert.lengthOf(body.doc, 2)
    const heading = canvas.sheets[1].frames.find((f) => f.id === 's1-heading') as TextFrame
    assert.deepInclude(heading.style, { family: 'display', weight: 700 })
    for (const sheet of canvas.sheets)
      for (const f of sheet.frames)
        if (f.kind === 'text') assert.include(['sans', 'display', 'brand'], f.style.family ?? '')
  })

  test('a text frame with no text and an image frame with no picture are dropped', ({ assert }) => {
    const pages = inputs()
    pages[1].texts.delete('lead')
    pages[1].pictures = new Map()
    const { canvas } = compose(pages)
    const ids = canvas.sheets[1].frames.map((f) => f.id)
    assert.notInclude(ids, 's1-lead')
    assert.notInclude(ids, 's1-photo')
    assert.include(ids, 's1-body')
  })

  test('chunks collapse to one superscript per document; the sources page prints the same numbers', ({
    assert,
  }) => {
    const { canvas, references } = compose()
    const numbers = citationNumbers(canvas)
    // Documents: Research summary 1 (c1, c2) and Field notes (c3), numbered in reading order.
    assert.equal(numbers.size, 2)
    const body = canvas.sheets[1].frames.find((f) => f.id === 's1-body') as TextFrame
    const cites: string[] = []
    walkNodes(body.doc, (n) => {
      if (n.type === 'sourceCitation') cites.push(String(n.attrs?.sourceChunkId))
    })
    assert.lengthOf(cites, 2)
    assert.lengthOf(new Set(cites), 2)
    assert.deepInclude(body.style, { citeSize: 6.7 })
    const sourcesSheet = canvas.sheets.at(-1)!
    const printed = sourcesSheet.frames
      .filter((f): f is TextFrame => f.kind === 'text' && /-ref-\d+-number$/.test(f.id))
      .map((f) => Number(texts(f)))
    assert.deepEqual(printed, [1, 2])
    assert.deepEqual(
      references.map((r) => r.number),
      [1, 2]
    )
    const names = sourcesSheet.frames
      .filter((f): f is TextFrame => f.kind === 'text' && /-ref-\d+-name$/.test(f.id))
      .map(texts)
    assert.includeMembers(names, ['Research summary 1', 'Field notes'])
    // The locator names the pages and chunks.
    assert.match(
      sourcesSheet.frames.map((f) => (f.kind === 'text' ? texts(f) : '')).join('\n'),
      /Pages 2–4 · chunks 1–2/
    )
  })

  test('claims become an evidence table with the source number and evidence kind', ({ assert }) => {
    const { canvas } = compose()
    const all = canvas.sheets
      .at(-1)!
      .frames.map((f) => (f.kind === 'text' ? texts(f) : ''))
      .join('\n')
    assert.include(all, 'Evidence at a glance')
    assert.include(all, 'Surface temperatures fell')
    assert.include(all, 'Measured result')
  })

  test('no citations means no sources page', ({ assert }) => {
    const pages = inputs().map((p) => ({
      ...p,
      texts: new Map([...p.texts].map(([id, t]) => [id, { ...t, chunks: [] }])),
    }))
    const { canvas } = compose(pages)
    assert.equal(canvas.sheets.length, 3)
  })

  test('many documents flow onto further sources pages that keep their numbers', ({ assert }) => {
    const many = new Map(sources)
    for (let i = 0; i < 30; i++)
      many.set(`d${i}`, { fileName: `Document ${i}.pdf`, pageNumber: i + 1, chunkIndex: 0 })
    const pages = inputs()
    pages[1].texts.set('body', { text: 'Text.', chunks: [...many.keys()] })
    const { canvas } = composeAiDesign({
      system: sampleDesign().system,
      pages,
      sources: many,
      footer: 'Title',
    })
    assert.isAbove(canvas.sheets.length, 5)
    assert.isTrue(parseCanvas(canvas).ok)
    const frames = canvas.sheets.slice(3).flatMap((s) => s.frames)
    assert.isTrue(frames.every((f) => f.geo.y + f.geo.h <= 2970 && f.geo.x + f.geo.w <= 2100))
    const nums = frames
      .filter((f): f is TextFrame => f.kind === 'text' && /-ref-\d+-number$/.test(f.id))
      .map((f) => Number(texts(f)))
    assert.deepEqual(
      nums,
      Array.from({ length: nums.length }, (_, i) => i + 1)
    )
    assert.lengthOf(nums, 32)
    // Footers count the pages.
    const footer = canvas.sheets
      .at(-1)!
      .frames.find((f) => f.id.endsWith('footer-page')) as TextFrame
    assert.equal(texts(footer), `${canvas.sheets.length} / ${canvas.sheets.length}`)
  })
})

test.group('AI design: text rules and fit', () => {
  const frame = sampleDesign().pages[1].frames.find((f) => f.id === 'body')!
  const style = resolveText(frame, sampleDesign().system)

  test('citation tags, gap sentences and brand spellings are cleaned, paragraphs kept', ({
    assert,
  }) => {
    const out = cleanFrameText(
      'Surface fell [chunk: c1]. The sources do not provide pricing. Humble bee AI built it.\nSecond para.',
      'HumbleBee AI'
    )
    assert.equal(out.text, 'Surface fell. HumbleBee AI built it.\nSecond para.')
    assert.lengthOf(out.gaps, 1)
  })

  test('facts need a chunk, and numbers must be in the cited chunk', ({ assert }) => {
    const evidence = new Map([['c1', 'Surface temperatures fell by 83% across 12 districts.']])
    const base = { id: 'body', cite: true }
    assert.deepEqual(frameProblems({ ...base, text: 'It fell.', chunks: [] }, evidence), [
      { code: 'uncited', id: 'body' },
    ])
    assert.deepEqual(
      frameProblems({ ...base, text: 'It fell by 83%.', chunks: ['c1'] }, evidence),
      []
    )
    assert.equal(
      frameProblems({ ...base, text: 'It fell by 90%.', chunks: ['c1'] }, evidence)[0].detail,
      '90'
    )
    assert.deepEqual(
      frameProblems({ ...base, cite: false, text: 'Title', chunks: [] }, evidence),
      []
    )
    assert.deepEqual(
      frameProblems({ ...base, text: 'No sources at all.', chunks: [] }, new Map()),
      []
    )
  })

  test('measurement is the portfolio measure for Inter and wider for the brand font', ({
    assert,
  }) => {
    const text =
      'The service team reviewed each request and agreed the next step together. '.repeat(3)
    const m = measureText(text, frame, style)
    assert.equal(
      m.lines,
      lineCount(text.trim(), (frame.w - 0) / 3.5278, {
        size: 9.5,
        line: 13.775,
        weight: 400,
        color: 'navy',
      })
    )
    const brand = { ...style, family: 'brand' as const }
    assert.isAtLeast(measureText(text, frame, brand).lines, m.lines)
    // Two paragraphs add the canvas paragraph gap.
    const two = measureText('One.\nTwo.', frame, style)
    assert.approximately(two.height, 2 * 13.775 + 0.6 * 9.5, 0.01)
  })

  test('text over its frame is cut at a sentence, then at a word, and fits afterwards', ({
    assert,
  }) => {
    const sentence = 'Surface temperatures fell by 83% across twelve monitored districts. '
    const long = sentence.repeat(60).trim()
    assert.isFalse(fitsFrame(long, frame, style))
    const cut = trimToFrame(long, frame, style)
    assert.isTrue(cut.cut)
    assert.isTrue(fitsFrame(cut.text, frame, style))
    assert.isTrue(cut.text.endsWith('.'))
    assert.isAbove(cut.text.length, 400)
    // A single over-long sentence is cut at a word.
    const small = { w: 400, h: 120 }
    const one = trimToFrame('word '.repeat(200).trim(), small, style)
    assert.isTrue(fitsFrame(one.text, small, style))
    assert.notMatch(one.text, /wor\.$/)
    // Text that fits is returned untouched.
    assert.deepEqual(trimToFrame('Short.', frame, style), { text: 'Short.', cut: false })
  })
})

test.group('AI design: pictures', () => {
  const pic = (ref: string, width: number, height: number, caption: string): Picture => ({
    ref,
    origin: 'upload',
    imageId: `id-${ref}`,
    width,
    height,
    aspect: width > height ? 'landscape' : 'portrait',
    caption,
    phash: null,
    bytes: 100_000,
  })
  const { design } = normalizeDesign(sampleDesign(4))

  test('the requested ref wins; otherwise the picture that suits the subject and shape; no repeats', ({
    assert,
  }) => {
    const frames = structuredClone(design.pages)
    Object.assign(
      frames[1].frames.find((f) => f.kind === 'image')!,
      { imageRef: 'img2' }
    )
    Object.assign(
      frames[2].frames.find((f) => f.kind === 'image')!,
      {
        subject: 'a street with trees in the district',
      }
    )
    const pictures = [
      pic('img1', 1000, 1000, 'chart of budgets'),
      pic('img2', 1600, 1000, 'rooftop'),
      pic('img3', 800, 1200, 'a street with trees in the district'),
    ]
    const out = assignPictures(frames, pictures)
    assert.deepEqual(
      out.map((o) => [o.page, o.frame, o.picture.ref]),
      [
        [1, 'photo', 'img2'],
        [2, 'photo', 'img3'],
        [3, 'photo', 'img1'],
      ]
    )
  })

  test('with fewer pictures than frames the rest stay empty; cover or contain follows the shape', ({
    assert,
  }) => {
    const out = assignPictures(design.pages, [pic('img1', 800, 1000, 'district')])
    assert.lengthOf(out, 1)
    assert.equal(fitFor({ width: 800, height: 1000 }, { w: 550, h: 700 }), 'cover')
    assert.equal(fitFor({ width: 2000, height: 800 }, { w: 550, h: 700 }), 'contain')
    assert.equal(out[0].fit, 'cover')
    assert.equal(assignPictures(design.pages, []).length, 0)
  })

  test('caption overlap is the share of the picture words the subject shares', ({ assert }) => {
    assert.equal(wordOverlap('trees in the district', 'trees district'), 1)
    assert.equal(wordOverlap('budget', 'trees district'), 0)
    assert.equal(wordOverlap('', 'trees'), 0)
  })
})
