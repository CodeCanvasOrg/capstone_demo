import { test } from '@japa/runner'
import { imageCss } from '../../shared/canvas/css.ts'
import { SHEET, parseCanvas, type Frame } from '../../shared/canvas/model.ts'
import { DEFAULT_SIZE, IMAGE_WIDTH, fitToImage, imageGeo } from '../../shared/canvas/ops.ts'
import { renderCanvasHtml } from '#services/exports/canvas_renderer'
import { BRAND_KITS } from '../../shared/layout/brand.ts'
import { IMAGE, minimal } from '../fixtures/canvas/index.ts'

type ImageFrame = Extract<Frame, { kind: 'image' }>
const imageOf = (canvas: ReturnType<typeof minimal>) =>
  canvas.sheets[1].frames.find((f) => f.kind === 'image') as ImageFrame

test.group('canvas images', () => {
  test('a focal point is stored when in range and refused outside it', ({ assert }) => {
    const ok = minimal()
    imageOf(ok).focus = { x: 20, y: 80 }
    const parsed = parseCanvas(ok, { imageIds: new Set([IMAGE]) })
    assert.isTrue(parsed.ok)
    if (parsed.ok) assert.deepEqual(imageOf(parsed.canvas as never).focus, { x: 20, y: 80 })
    for (const focus of [
      { x: 101, y: 0 },
      { x: -1, y: 0 },
      { x: 1.5, y: 0 },
      { x: '50%', y: 0 },
    ]) {
      const bad = minimal() as any
      imageOf(bad).focus = focus
      assert.isFalse(parseCanvas(bad).ok, JSON.stringify(focus))
    }
    const extra = minimal() as any
    imageOf(extra).focus = { x: 1, y: 1, z: 'url(x)' }
    assert.isFalse(parseCanvas(extra).ok)
  })

  test('the picture is cropped around its focal point, centred by default', ({ assert }) => {
    const frame = imageOf(minimal())
    assert.equal(imageCss({ ...frame, fit: 'cover' }), 'object-fit:cover;object-position:50% 50%')
    assert.equal(
      imageCss({ ...frame, fit: 'contain', focus: { x: 0, y: 100 } }),
      'object-fit:contain;object-position:0% 100%'
    )
  })

  test('a dropped picture keeps its proportions and stays on the sheet', ({ assert }) => {
    const wide = imageGeo({ x: 1050, y: 1485 }, { width: 400, height: 200 })
    assert.deepEqual(wide, { x: 650, y: 1285, w: IMAGE_WIDTH, h: IMAGE_WIDTH / 2 })
    // Dropped near a corner: pushed back inside.
    const corner = imageGeo({ x: 0, y: 0 }, { width: 100, height: 100 })
    assert.include(corner, { x: 0, y: 0, w: IMAGE_WIDTH, h: IMAGE_WIDTH })
    // Very tall: scaled to the sheet's height.
    const tall = imageGeo({ x: 1050, y: 1485 }, { width: 10, height: 1000 })
    assert.equal(tall.h, SHEET.h)
    assert.isAtMost(tall.x + tall.w, SHEET.w)
    // Unknown size: the default image box.
    const unknown = imageGeo({ x: 1050, y: 1485 }, { width: null, height: null })
    assert.include(unknown, DEFAULT_SIZE.image)
  })

  test('fitting a box to its picture keeps the width, or shrinks to stay on the page', ({
    assert,
  }) => {
    assert.deepEqual(fitToImage({ x: 100, y: 100, w: 600, h: 600 }, { width: 300, height: 100 }), {
      x: 100,
      y: 100,
      w: 600,
      h: 200,
    })
    const low = fitToImage({ x: 0, y: 2700, w: 800, h: 200 }, { width: 100, height: 100 })
    assert.equal(low.y + low.h, SHEET.h)
    assert.equal(low.w, low.h)
  })

  test('the export draws an embedded picture with its fit and focus, and nothing else', async ({
    assert,
  }) => {
    const canvas = minimal()
    const frame = imageOf(canvas)
    frame.focus = { x: 10, y: 90 }
    const brand = BRAND_KITS[0]
    const embedded = new Map([
      [frame.id, [{ type: 'image', src: 'data:image/png;base64,AAAA', alt: '' } as never]],
    ])
    const html = await renderCanvasHtml(canvas, brand, { content: embedded })
    assert.include(html, 'src="data:image/png;base64,AAAA"')
    assert.include(html, `object-fit:${frame.fit};object-position:10% 90%`)
    // A remote address never reaches the page: the renderer would fetch it.
    const remote = new Map([
      [frame.id, [{ type: 'image', src: 'https://evil.test/x.png', alt: '' } as never]],
    ])
    assert.notInclude(await renderCanvasHtml(canvas, brand, { content: remote }), 'evil.test')
  })
})
