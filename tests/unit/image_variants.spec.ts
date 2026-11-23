import { test } from '@japa/runner'
import {
  DUPLICATE_DISTANCE,
  aspectClass,
  chooseVariant,
  coverSize,
  designForAspect,
  framePixels,
  hamming,
  isDuplicate,
  printDpi,
  rejection,
  scoreCandidate,
} from '../../shared/canvas/image_rules.ts'

const variants = [
  { purpose: 'thumb', width: 320, height: 240 },
  { purpose: 'screen', width: 1600, height: 1200 },
  { purpose: 'print', width: 3508, height: 2631 },
] as const

test.group('image variants and slots', () => {
  test('the aspect class decides the design variant', ({ assert }) => {
    assert.equal(aspectClass(1200, 800), 'landscape')
    assert.equal(aspectClass(1200, 1000), 'landscape')
    assert.equal(aspectClass(1000, 1000), 'square')
    assert.equal(aspectClass(1100, 1000), 'square')
    assert.equal(aspectClass(830, 1000), 'portrait')
    assert.equal(aspectClass(600, 1000), 'portrait')
    assert.equal(designForAspect('landscape'), 'figure_text')
    assert.equal(designForAspect('portrait'), 'side_figure')
    assert.equal(designForAspect('square'), 'side_figure')
  })

  test('a frame needs its size in pixels at 300 dpi', ({ assert }) => {
    // 170 x 64 mm.
    assert.deepEqual(framePixels({ w: 1700, h: 640 }), { w: 2008, h: 756 })
    assert.deepEqual(framePixels({ w: 1700, h: 640 }, 150), { w: 1004, h: 378 })
  })

  test('the smallest variant with enough pixels is chosen, the largest when none has', ({
    assert,
  }) => {
    // A 40 x 30 mm frame needs 473 x 355 px: thumb (320) is too small, screen is enough.
    assert.equal(chooseVariant(variants, { w: 400, h: 300 })?.purpose, 'screen')
    // A 150 x 100 mm frame needs 1772 x 1181 px: only print has it.
    assert.equal(chooseVariant(variants, { w: 1500, h: 1000 })?.purpose, 'print')
    // A 20 x 15 mm frame needs 237 x 177 px: thumb will do.
    assert.equal(chooseVariant(variants, { w: 200, h: 150 })?.purpose, 'thumb')
    // A full sheet is bigger than any variant: take the print one.
    assert.equal(chooseVariant(variants, { w: 2100, h: 2970 })?.purpose, 'print')
    // A picture smaller than any frame needs is the same in every copy: the print one is best.
    const tiny = [
      { purpose: 'thumb', width: 40, height: 10 },
      { purpose: 'screen', width: 40, height: 10 },
      { purpose: 'print', width: 40, height: 10 },
    ] as const
    assert.equal(chooseVariant(tiny, { w: 800, h: 400 })?.purpose, 'print')
    assert.isNull(chooseVariant([], { w: 400, h: 300 }))
    // A lower resolution target can use a smaller variant.
    assert.equal(chooseVariant(variants, { w: 1500, h: 1000 }, 100)?.purpose, 'screen')
  })

  test('a picture is resized to cover its frame and never enlarged', ({ assert }) => {
    const frame = { w: 1700, h: 640 }
    const need = framePixels(frame)
    const big = coverSize({ width: 3508, height: 2631 }, frame)
    assert.isAtLeast(big.width, need.w)
    assert.isAtLeast(big.height, need.h)
    assert.isBelow(big.width, 3508)
    // Aspect is kept.
    assert.closeTo(big.width / big.height, 3508 / 2631, 0.01)
    // A picture smaller than the frame is left alone.
    assert.deepEqual(coverSize({ width: 500, height: 300 }, frame), { width: 500, height: 300 })
  })

  test('effective resolution uses the short edges', ({ assert }) => {
    assert.equal(printDpi({ width: 2400, height: 1600 }, { w: 1700, h: 640 }), 635)
    assert.isBelow(printDpi({ width: 600, height: 400 }, { w: 1700, h: 1000 }), 200)
  })

  test('near-identical hashes are duplicates, different ones are not', ({ assert }) => {
    const a = 'ffff0000ffff0000'
    assert.equal(hamming(a, a), 0)
    assert.equal(hamming(a, 'ffff0000ffff0001'), 1)
    assert.equal(hamming('0000000000000000', 'ffffffffffffffff'), 64)
    assert.equal(hamming('abc', a), 64)
    assert.isTrue(isDuplicate(a, ['0000000000000000', 'ffff0000ffff003f']))
    assert.equal(hamming(a, 'ffff0000ffff003f'), DUPLICATE_DISTANCE)
    assert.isFalse(isDuplicate(a, ['ffff0000ffff00ff']))
    assert.isFalse(isDuplicate(null, [a]))
    assert.isFalse(isDuplicate(a, [null, undefined]))
  })

  test('small, narrow and tiny pictures are rejected for a slot', ({ assert }) => {
    assert.isNull(rejection({ width: 1200, height: 800, bytes: 90_000 }, 600))
    assert.match(rejection({ width: 500, height: 400, bytes: 90_000 }, 600)!, /under 600px/)
    assert.isNull(rejection({ width: 500, height: 400, bytes: 90_000 }, 300))
    assert.match(rejection({ width: 2400, height: 400, bytes: 90_000 }, 300)!, /narrow/)
    assert.match(rejection({ width: 1200, height: 800, bytes: 2000 }, 600)!, /file/)
    assert.isNull(rejection({ width: 1600, height: 400, bytes: 90_000 }, 400))
  })

  test('the score rewards the source page and penalises reuse', ({ assert }) => {
    assert.equal(scoreCandidate({ similarity: 0.5 }), 0.5)
    assert.equal(scoreCandidate({ similarity: 0.5, sameSourcePage: true }), 0.7)
    assert.equal(scoreCandidate({ similarity: 0.5, alreadyUsed: true }), 0.2)
    assert.equal(scoreCandidate({ similarity: 0.5, sameSourcePage: true, alreadyUsed: true }), 0.4)
  })
})
