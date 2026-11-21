import { test } from '@japa/runner'
import { LIMITS, parseCanvas } from '../../shared/canvas/model.ts'
import { IMAGE, malicious, minimal } from '../fixtures/canvas/index.ts'

const problems = (input: unknown, imageIds?: Set<string>) => {
  const result = parseCanvas(input, { imageIds })
  return result.ok ? [] : result.problems.map((p) => p.message)
}

test.group('canvas model', () => {
  test('a valid canvas is accepted as is', ({ assert }) => {
    const result = parseCanvas(minimal(), { imageIds: new Set([IMAGE]) })
    assert.isTrue(result.ok)
    if (result.ok) assert.deepEqual(result.canvas, minimal())
  })

  test('unknown keys are dropped, never stored', ({ assert }) => {
    const input = minimal() as any
    input.extra = 'x'
    input.sheets[0].frames[0].onerror = 'alert(1)'
    input.sheets[0].frames[0].attributes = { onclick: 'alert(1)' }
    input.sheets[0].frames[0].style.position = 'fixed'
    const result = parseCanvas(input)
    assert.isTrue(result.ok)
    if (!result.ok) return
    const json = JSON.stringify(result.canvas)
    assert.notInclude(json, 'onerror')
    assert.notInclude(json, 'onclick')
    assert.notInclude(json, 'fixed')
    assert.notProperty(result.canvas, 'extra')
  })

  test('an unknown frame kind is refused', ({ assert }) => {
    assert.isNotEmpty(problems(malicious.scriptKind()))
  })

  test('raw HTML inside text is refused', ({ assert }) => {
    assert.isNotEmpty(problems(malicious.htmlInText()))
  })

  test('a colour cannot smuggle CSS', ({ assert }) => {
    assert.isNotEmpty(problems(malicious.styleInjection()))
  })

  test('a link must be http(s) or mailto', ({ assert }) => {
    assert.include(problems(malicious.linkScheme()).join(' '), 'Link not allowed')
  })

  test('ids are plain tokens, safe as HTML ids and CSS selectors', ({ assert }) => {
    assert.isNotEmpty(problems(malicious.badId()))
  })

  test('a frame must stay inside its sheet', ({ assert }) => {
    assert.include(problems(malicious.outsideSheet()).join(' '), 'inside its sheet')
  })

  test('images must belong to the document', ({ assert }) => {
    assert.include(problems(malicious.foreignImage(), new Set()).join(' '), 'Unknown image')
  })

  test('an image inside text must be a document image at its own address', ({ assert }) => {
    const input = minimal() as any
    const image = (src: unknown) => [{ type: 'image', attrs: { documentImageId: IMAGE, src } }]
    input.sheets[0].frames[0].doc = image('https://evil.example/x.png')
    assert.include(problems(input).join(' '), 'Image address not allowed')
    input.sheets[0].frames[0].doc = image(`/workspaces/${IMAGE}/documents/${IMAGE}/images/${IMAGE}`)
    assert.isEmpty(problems(input, new Set([IMAGE])))
    input.sheets[0].frames[0].doc = [{ type: 'image', attrs: { src: '/x.png' } }]
    assert.include(problems(input).join(' '), 'document images')
  })

  test('a page break inside a frame is refused', ({ assert }) => {
    const input = minimal() as any
    input.sheets[0].frames[0].doc.push({ type: 'horizontalRule' })
    assert.include(problems(input).join(' '), 'between sheets')
  })

  test('duplicate ids are refused', ({ assert }) => {
    const input = minimal() as any
    input.sheets[1].frames[0].id = 's0-f0'
    assert.include(problems(input).join(' '), 'Duplicate id')
  })

  test('limits: sheets, frames and size', ({ assert }) => {
    const many = minimal() as any
    many.sheets = Array.from({ length: LIMITS.sheets + 1 }, (_, i) => ({
      id: `s${i}`,
      frames: [],
    }))
    assert.isNotEmpty(problems(many))
    const huge = minimal() as any
    huge.sheets[0].frames[0].doc = [
      { type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(LIMITS.bytes) }] },
    ]
    assert.include(problems(huge).join(' '), 'too large')
  })
})
