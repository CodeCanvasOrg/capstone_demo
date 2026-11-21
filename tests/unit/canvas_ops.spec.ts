import { test } from '@japa/runner'
import { parseCanvas, type CanvasDocument } from '../../shared/canvas/model.ts'
import {
  duplicateFrame,
  duplicateSheet,
  freshId,
  newFrame,
  newSheet,
} from '../../shared/canvas/ops.ts'
import { minimal } from '../fixtures/canvas/index.ts'

const ids = (canvas: CanvasDocument) =>
  new Set(canvas.sheets.flatMap((s) => [s.id, ...s.frames.map((f) => f.id)]))

test.group('canvas editing operations', () => {
  test('fresh ids never collide', ({ assert }) => {
    assert.equal(freshId(new Set(['s0', 's1']), 's'), 's2')
    assert.equal(freshId(new Set(), 's0-f'), 's0-f0')
  })

  test('every new frame kind is valid on its sheet, on top and last in reading order', ({
    assert,
  }) => {
    for (const kind of ['text', 'figure', 'image', 'shape', 'art'] as const) {
      const canvas = minimal()
      const sheet = canvas.sheets[0]
      const frame = newFrame(kind, sheet, ids(canvas))
      sheet.frames.push(frame)
      assert.isTrue(parseCanvas(canvas).ok, kind)
      assert.equal(frame.z, Math.max(...sheet.frames.map((f) => f.z)))
      assert.equal(frame.order, Math.max(...sheet.frames.map((f) => f.order)))
    }
  })

  test('new frames do not land exactly on top of each other', ({ assert }) => {
    const canvas = minimal()
    const sheet = canvas.sheets[0]
    const a = newFrame('text', sheet, ids(canvas))
    sheet.frames.push(a)
    const b = newFrame('text', sheet, ids(canvas))
    assert.notDeepEqual([a.geo.x, a.geo.y], [b.geo.x, b.geo.y])
  })

  test('duplicated sheets and frames get fresh ids and stay valid', ({ assert }) => {
    const canvas = minimal()
    canvas.sheets.push(duplicateSheet(canvas.sheets[0], ids(canvas)))
    canvas.sheets[0].frames.push(
      duplicateFrame(canvas.sheets[0].frames[0], canvas.sheets[0], ids(canvas))
    )
    canvas.sheets.push(newSheet(ids(canvas)))
    const parsed = parseCanvas(canvas)
    assert.isTrue(parsed.ok, parsed.ok ? '' : JSON.stringify(parsed.problems))
  })
})
