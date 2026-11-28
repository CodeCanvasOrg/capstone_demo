import { test } from '@japa/runner'
import { canvasOptionsSchema } from '../../shared/canvas/options.ts'
import { canvasDesignSchema } from '../../shared/canvas/ai_design/schema.ts'
import { blend, contrast, requiredContrast } from '../../shared/canvas/ai_design/color.ts'
import { normalizeDesign, tokenFor } from '../../shared/canvas/ai_design/normalize.ts'
import { validateDesign } from '../../shared/canvas/ai_design/validate.ts'
import { modelSchema, parseLenient } from '../../shared/canvas/model_output.ts'
import { modelAcceptsImages } from '../../app/services/canvas/ai_design/capabilities.ts'
import { designPageCount } from '../../app/services/canvas/ai_design/ai_design_digest.ts'
import { designSystemPrompt } from '../../app/services/canvas/ai_design/ai_design_prompts.ts'
import { contentPage, coverPage, sampleDesign } from '../helpers/ai_design.ts'
import type { CanvasDesign, DesignFrame } from '../../shared/canvas/ai_design/schema.ts'

const rules = { pages: 3, allowBrandFont: true }
const clone = (d: CanvasDesign) => structuredClone(d)
const frame = (d: CanvasDesign, page: number, id: string) =>
  d.pages[page].frames.find((f) => f.id === id)!
const codes = (d: CanvasDesign, options = rules) =>
  validateDesign(normalizeDesign(d).design, options).map((p) => p.code)

test.group('AI design: options', () => {
  test('ai_design is a template set; the retired sets still mean the portfolio', ({ assert }) => {
    assert.equal(canvasOptionsSchema.parse({ templateSet: 'ai_design' }).templateSet, 'ai_design')
    for (const retired of ['academic_report', 'research_brief', 'brochure', 'portfolio'])
      assert.equal(canvasOptionsSchema.parse({ templateSet: retired }).templateSet, 'portfolio')
    assert.equal(canvasOptionsSchema.parse({}).templateSet, 'portfolio')
    assert.isFalse(canvasOptionsSchema.safeParse({ templateSet: 'other' }).success)
  })

  test('the page count comes from pages, entries, then depth held down to the sources', ({
    assert,
  }) => {
    const base = { pages: 'auto', entries: 'auto', depth: 'standard' } as const
    assert.equal(designPageCount({ ...base, pages: 9 }), 9)
    assert.equal(designPageCount({ ...base, entries: 3 }), 4)
    assert.equal(designPageCount(base), 6)
    assert.equal(designPageCount({ ...base, depth: 'detailed' }), 8)
    assert.equal(designPageCount(base, 450), 4)
    assert.equal(designPageCount(base, 20), 3)
    assert.equal(designPageCount({ ...base, entries: 2 }, 20), 3)
  })
})

test.group('AI design: schema', () => {
  test('a design the model could return parses, and its JSON schema is shown without limits', ({
    assert,
  }) => {
    assert.isTrue(canvasDesignSchema.safeParse(sampleDesign(4)).success)
    const shown = JSON.stringify(modelSchema(canvasDesignSchema))
    assert.notInclude(shown, 'maxLength')
    assert.include(shown, 'palette')
  })

  test('an over-long list or string is cut by the lenient parse, not rejected', ({ assert }) => {
    const design = sampleDesign(3)
    design.reviewer_notes = Array.from({ length: 12 }, (_, i) => `note ${i}`)
    design.pages[0].purpose = 'x '.repeat(400)
    const parsed = parseLenient(canvasDesignSchema, design)
    assert.isTrue(parsed.success)
    if (parsed.success) {
      assert.lengthOf(parsed.data.reviewer_notes, 8)
      assert.isAtMost(parsed.data.pages[0].purpose.length, 300)
    }
  })

  test('colours must be palette roles or hex, and the palette must be hex', ({ assert }) => {
    const bad = clone(sampleDesign(3))
    bad.system.palette.ink = 'navy'
    assert.isFalse(canvasDesignSchema.safeParse(bad).success)
    const color = clone(sampleDesign(3))
    ;(frame(color, 1, 'heading').style as { color: string }).color = 'rebeccapurple'
    assert.isFalse(canvasDesignSchema.safeParse(color).success)
  })
})

test.group('AI design: clamping', () => {
  test('text and images are held inside the margins; shapes may bleed', ({ assert }) => {
    const d = clone(sampleDesign(3))
    Object.assign(frame(d, 1, 'heading'), { x: -50, y: 20, w: 2600, h: 300 })
    Object.assign(frame(d, 1, 'photo'), { x: 1900, y: 2900, w: 550, h: 700 })
    Object.assign(frame(d, 0, 'band'), { x: -40, y: -40, w: 2300, h: 1700 })
    const { design, notes } = normalizeDesign(d)
    const heading = frame(design, 1, 'heading')
    assert.equal(heading.x, 200)
    assert.equal(heading.y, 200)
    assert.equal(heading.w, 1700)
    const photo = frame(design, 1, 'photo')
    assert.isAtMost(photo.x + photo.w, 1900)
    assert.isAtMost(photo.y + photo.h, 2770)
    const band = frame(design, 0, 'band')
    assert.deepInclude(band, { x: 0, y: 0, w: 2100 })
    assert.match(notes.join(' '), /placed \d+ frames? outside the page margins/)
  })

  test('a frame is never below the minimum size, and a design in bounds is untouched', ({
    assert,
  }) => {
    const d = clone(sampleDesign(3))
    Object.assign(frame(d, 1, 'caption'), { w: 5, h: 5 })
    const { design } = normalizeDesign(d)
    assert.isAtLeast(frame(design, 1, 'caption').w, 200)
    const ok = normalizeDesign(sampleDesign(3))
    assert.deepEqual(ok.notes, [])
    assert.deepEqual(
      JSON.parse(JSON.stringify(ok.design.pages)),
      JSON.parse(JSON.stringify(sampleDesign(3).pages))
    )
  })

  test('ids become unique tokens, roles follow the kind, extras are dropped', ({ assert }) => {
    assert.equal(tokenFor('Hero Title!', new Set(), 'f1'), 'hero-title')
    assert.equal(tokenFor('9lives', new Set(), 'f1'), 'f9lives')
    assert.equal(tokenFor('title', new Set(['title']), 'f1'), 'title-2')
    const d = clone(sampleDesign(3))
    d.pages[1].frames.push({ ...frame(d, 1, 'heading') })
    d.pages[1].frames.push({
      ...frame(d, 1, 'heading'),
      kind: 'shape' as const,
      role: 'body' as const,
    })
    const imageFrame = frame(d, 1, 'photo')
    for (let i = 0; i < 6; i++) d.pages[1].frames.push({ ...imageFrame, id: `extra${i}` })
    const { design, notes } = normalizeDesign(d)
    const ids = design.pages[1].frames.map((f) => f.id)
    assert.lengthOf(new Set(ids), ids.length)
    assert.include(ids, 'heading-2')
    assert.equal(design.pages[1].frames.find((f) => f.id === 'heading-3')!.role, 'decor')
    assert.isAtMost(design.pages[1].frames.filter((f) => f.kind === 'image').length, 4)
    assert.match(notes.join(' '), /dropped to keep at most/)
  })
})

test.group('AI design: validation', () => {
  test('the sample design is valid', ({ assert }) => {
    assert.deepEqual(codes(sampleDesign(3)), [])
  })

  test('the wrong number of pages is rejected', ({ assert }) => {
    assert.include(codes(sampleDesign(2)), 'pages')
    assert.notInclude(codes(sampleDesign(3)), 'pages')
    const messages = validateDesign(sampleDesign(4), rules).map((p) => p.message)
    assert.match(messages.join(' '), /Design exactly 3 pages; the design had 4/)
  })

  test('body below 8 pt and captions below 7 pt are illegible', ({ assert }) => {
    const small = clone(sampleDesign(3))
    ;(frame(small, 1, 'body').style as { size: number }).size = 7
    assert.include(codes(small), 'size')
    const caption = clone(sampleDesign(3))
    ;(frame(caption, 1, 'caption').style as { size: number }).size = 6.5
    assert.include(codes(caption), 'size')
    const fine = clone(sampleDesign(3))
    ;(frame(fine, 1, 'caption').style as { size: number }).size = 7
    ;(frame(fine, 1, 'body').style as { size: number }).size = 8
    assert.deepEqual(codes(fine), [])
  })

  test('the size comes from the role when the frame does not set one', ({ assert }) => {
    const d = clone(sampleDesign(3))
    d.system.scale.body = 8
    delete (frame(d, 1, 'body') as { style?: unknown }).style
    assert.deepEqual(codes(d), [])
    d.system.scale.body = 7.5
    assert.include(codes(d), 'size')
  })

  test('contrast below WCAG AA against the page, a panel or the frame fill is rejected', ({
    assert,
  }) => {
    assert.isAbove(contrast('#000000', '#ffffff'), 20.9)
    assert.equal(requiredContrast(18, 400), 3)
    assert.equal(requiredContrast(14, 700), 3)
    assert.equal(requiredContrast(12, 700), 4.5)
    // The body in the muted grey on the paper is fine; light grey is not.
    const page = clone(sampleDesign(3))
    ;(frame(page, 1, 'body').style as { color: string }).color = '#bbbbbb'
    assert.include(codes(page), 'contrast')
    // The quote sits on the surface panel: white text on it fails, ink passes.
    const panel = clone(sampleDesign(3))
    ;(frame(panel, 1, 'quote').style as { color: string }).color = '#ffffff'
    const found = validateDesign(normalizeDesign(panel).design, rules).find(
      (p) => p.code === 'contrast'
    )!
    assert.equal(found.frame, 'quote')
    assert.match(found.message, /WCAG AA needs 4.5/)
    // The cover's paper text on its navy band passes; moving the band away breaks it.
    const cover = clone(sampleDesign(3))
    assert.deepEqual(codes(cover), [])
    Object.assign(frame(cover, 0, 'band'), { h: 300 })
    assert.include(codes(cover), 'contrast')
    // A frame's own opaque fill is what counts.
    const own = clone(cover)
    ;(frame(own, 0, 'title').style as { fill: string }).fill = 'primary'
    ;(frame(own, 0, 'eyebrow').style as { fill: string }).fill = 'primary'
    ;(frame(own, 0, 'subtitle').style as { fill: string }).fill = 'primary'
    assert.deepEqual(codes(own), [])
    // Large text needs only 3.
    const large = clone(sampleDesign(3))
    ;(frame(large, 1, 'heading').style as { color: string }).color = '#8a8a8a'
    assert.deepEqual(codes(large), [])
    ;(frame(large, 1, 'heading').style as { size: number }).size = 12
    assert.include(codes(large), 'contrast')
  })

  test('a translucent fill is blended before the contrast is measured', ({ assert }) => {
    assert.equal(blend('#000000', '#ffffff', 50), '#808080')
    const d = clone(sampleDesign(3))
    const body = frame(d, 1, 'body')
    body.style = { color: '#ffffff', fill: 'primary', fillAlpha: 100 }
    assert.deepEqual(codes(d), [])
    body.style = { color: '#ffffff', fill: 'primary', fillAlpha: 10 }
    assert.include(codes(d), 'contrast')
  })

  test('overlapping text, images or text over a picture are rejected; shapes behind text are fine', ({
    assert,
  }) => {
    const text = clone(sampleDesign(3))
    Object.assign(frame(text, 1, 'lead'), { y: 400 })
    assert.include(codes(text), 'overlap')
    const onPicture = clone(sampleDesign(3))
    Object.assign(frame(onPicture, 1, 'caption'), { y: 1300, h: 300 })
    assert.include(codes(onPicture), 'overlap')
    const twoImages = clone(sampleDesign(3))
    twoImages.pages[1].frames.push({ ...frame(twoImages, 1, 'photo'), id: 'photo-two' })
    assert.include(codes(twoImages), 'overlap')
    const message = validateDesign(normalizeDesign(text).design, rules).find(
      (p) => p.code === 'overlap'
    )!.message
    assert.match(message, /overlap/)
    // Text on a filled panel (its own opaque fill) over a picture is allowed.
    const filled = clone(onPicture)
    ;(frame(filled, 1, 'caption').style as Record<string, unknown>).fill = 'surface'
    ;(frame(filled, 1, 'caption').style as Record<string, unknown>).color = 'ink'
    assert.notInclude(codes(filled), 'overlap')
    // Touching edges are not an overlap.
    const touching = clone(sampleDesign(3))
    Object.assign(frame(touching, 1, 'lead'), { y: 500, h: 480 })
    assert.notInclude(codes(touching), 'overlap')
    // Text over art is rejected.
    const art = clone(sampleDesign(3))
    Object.assign(frame(art, 0, 'glow'), { x: 200, y: 300, w: 1000, h: 1000 })
    assert.include(codes(art), 'overlap')
  })

  test('the brand font is rejected when there is no brand font, and ink on paper must be readable', ({
    assert,
  }) => {
    const d = clone(sampleDesign(3))
    d.system.fonts.body = 'brand'
    assert.include(codes(d, { pages: 3, allowBrandFont: false }), 'font')
    assert.notInclude(codes(d, { pages: 3, allowBrandFont: true }), 'font')
    const faint = clone(sampleDesign(3))
    faint.system.palette.ink = '#cccccc'
    assert.include(codes(faint), 'palette')
  })

  test('a page with no text frame is rejected', ({ assert }) => {
    const d = clone(sampleDesign(3))
    d.pages[2].frames = d.pages[2].frames.filter((f) => f.kind !== 'text')
    assert.include(codes(d), 'text')
  })

  test('the prompt states the limits the validation enforces', ({ assert }) => {
    const prompt = designSystemPrompt({ pages: 5, brandFont: false })
    assert.include(prompt, 'exactly 5')
    assert.include(prompt, 'never smaller than 8 pt')
    assert.include(prompt, '2100 wide and 2970 high')
    assert.include(prompt, 'WCAG AA')
    assert.notInclude(prompt, 'brand)')
    assert.match(designSystemPrompt({ pages: 5, brandFont: true }), /sans, display, brand/)
  })
})

test.group('AI design: model capabilities', () => {
  const list = {
    data: [
      { id: 'a/vision', architecture: { input_modalities: ['text', 'image'] } },
      { id: 'a/text', architecture: { input_modalities: ['text'] } },
      { id: 'a/legacy', architecture: { modality: 'text+image->text' } },
      { id: 'a/none' },
    ],
  }

  test('a model accepts pictures only when its entry says so', ({ assert }) => {
    assert.isTrue(modelAcceptsImages(list, 'a/vision'))
    assert.isTrue(modelAcceptsImages(list, 'a/legacy'))
    assert.isFalse(modelAcceptsImages(list, 'a/text'))
    assert.isFalse(modelAcceptsImages(list, 'a/none'))
    assert.isFalse(modelAcceptsImages(list, 'a/unknown'))
    assert.isFalse(modelAcceptsImages({}, 'a/vision'))
    assert.isFalse(modelAcceptsImages(null, 'a/vision'))
  })
})

// Shape of the fixtures the other tests build on.
test('the sample pages carry the frames the tests rely on', ({ assert }) => {
  assert.isAbove(coverPage().frames.length, 4)
  assert.isTrue(contentPage(2).frames.some((f: DesignFrame) => f.kind === 'image'))
  assert.isFalse(contentPage(2, false).frames.some((f: DesignFrame) => f.kind === 'image'))
})
