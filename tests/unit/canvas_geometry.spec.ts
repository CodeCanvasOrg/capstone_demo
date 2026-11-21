import { test } from '@japa/runner'
import {
  clampGeo,
  fromPx,
  mm,
  parseLength,
  readingCompare,
  snapGeo,
  toPx,
} from '../../shared/canvas/geometry.ts'
import { SHEET } from '../../shared/canvas/model.ts'

test.group('canvas geometry', () => {
  test('px and tenths of a mm round-trip at any zoom', ({ assert }) => {
    for (const zoom of [0.5, 1, 1.75])
      for (const tenths of [0, 1, 205, 2100, 2970])
        assert.equal(fromPx(toPx(tenths, zoom), zoom), tenths)
  })

  test('lengths are written and read in mm, px and %', ({ assert }) => {
    assert.equal(mm(205), '20.5mm')
    assert.equal(mm(200), '20mm')
    assert.equal(parseLength('20.5mm', 'w'), 205)
    assert.equal(parseLength(toPx(300) + 'px', 'w'), 300)
    assert.equal(parseLength('50%', 'w'), SHEET.w / 2)
    assert.isNull(parseLength('auto', 'w'))
    assert.isNull(parseLength(undefined, 'h'))
  })

  test('a frame is kept inside its sheet and at least 2 mm', ({ assert }) => {
    assert.deepEqual(clampGeo({ x: -50, y: 3000, w: 5, h: 100 }), {
      x: 0,
      y: SHEET.h - 100,
      w: 20,
      h: 100,
    })
    assert.deepEqual(clampGeo({ x: 2000, y: 0, w: 500, h: 100 }), { x: 1600, y: 0, w: 500, h: 100 })
  })

  test('snaps to the nearest edge or centre, else the 1 mm grid', ({ assert }) => {
    const other = { x: 1000, y: 500, w: 400, h: 200 }
    // Left edge 8 tenths from the other frame's left edge: snaps to it.
    assert.equal(snapGeo({ x: 1008, y: 1203, w: 300, h: 100 }, [other]).x, 1000)
    // Nothing near: rounded to the grid.
    assert.equal(snapGeo({ x: 333, y: 1203, w: 300, h: 100 }, []).y, 1200)
    // Centre to the sheet centre.
    assert.equal(snapGeo({ x: 905, y: 1203, w: 300, h: 100 }, []).x, SHEET.w / 2 - 150)
  })

  test('reading order is rows first, then left to right', ({ assert }) => {
    const sorted = [
      { x: 900, y: 1000, w: 1, h: 1 },
      { x: 100, y: 1030, w: 1, h: 1 },
      { x: 100, y: 100, w: 1, h: 1 },
    ].sort(readingCompare)
    assert.deepEqual(
      sorted.map((g) => g.x + ':' + g.y),
      ['100:100', '100:1030', '900:1000']
    )
  })
})
