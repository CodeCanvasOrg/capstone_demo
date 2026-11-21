import { test } from '@japa/runner'
import { bundleHash, type ReviewBundle } from '../../shared/layout/bundle.ts'

const bundle: ReviewBundle = {
  contentHash: 'c'.repeat(64),
  versionId: '7b0c1f4e-1d2a-4c3b-9a8e-2f6d5c4b3a21',
  template: { id: 'case_study_standard', version: 1 },
  brand: { id: 'humblebee', version: 1 },
  options: {},
  assetIds: [],
  rendererVersion: 'brochure-1',
}

test.group('canvas in the approval bundle', () => {
  test('a bundle without a canvas hashes exactly as before', ({ assert }) => {
    assert.equal(bundleHash({ ...bundle, canvasHash: undefined }), bundleHash(bundle))
  })

  test('the canvas is part of what is approved', ({ assert }) => {
    const a = bundleHash({ ...bundle, rendererVersion: 'canvas-1', canvasHash: 'a'.repeat(64) })
    const b = bundleHash({ ...bundle, rendererVersion: 'canvas-1', canvasHash: 'b'.repeat(64) })
    assert.notEqual(a, b)
    assert.notEqual(a, bundleHash(bundle))
  })
})
