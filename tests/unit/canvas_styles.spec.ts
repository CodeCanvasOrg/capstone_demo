import { test } from '@japa/runner'
import { lookCss } from '../../shared/canvas/css.ts'
import { parseCanvas, type Frame } from '../../shared/canvas/model.ts'
import { minimal } from '../fixtures/canvas/index.ts'

/** The first frame of the minimal canvas with `style` applied. */
const withStyle = (style: Record<string, unknown>) => {
  const canvas = minimal() as any
  canvas.sheets[0].frames[0].style = style
  return canvas
}
const accepted = (style: Record<string, unknown>) => parseCanvas(withStyle(style)).ok
const textFrame = (style: Frame['style']): Frame => ({
  id: 'f',
  kind: 'text',
  geo: { x: 0, y: 0, w: 500, h: 500 },
  z: 0,
  order: 0,
  style,
  doc: [],
})

test.group('canvas styles', () => {
  test('custom colours, type and box styles are accepted', ({ assert }) => {
    assert.isTrue(
      accepted({
        fill: '#12ab34',
        fillAlpha: 40,
        color: 'accent',
        size: 13.5,
        family: 'serif',
        weight: 700,
        italic: true,
        caps: true,
        lineHeight: 120,
        tracking: 50,
        align: 'justify',
        border: { width: 5, color: '#000000', style: 'dashed' },
        shadow: 'md',
      })
    )
  })

  test('style values cannot smuggle CSS', ({ assert }) => {
    assert.isFalse(accepted({ family: 'Arial;background:url(x)' }))
    assert.isFalse(accepted({ size: '12pt;position:fixed' }))
    assert.isFalse(accepted({ size: 12.34 }))
    assert.isFalse(accepted({ weight: 900 }))
    assert.isFalse(accepted({ shadow: '0 0 0 red' }))
    assert.isFalse(accepted({ border: { width: 5, color: 'red;x:y', style: 'solid' } }))
    assert.isFalse(accepted({ border: { width: 5, color: '#000000', style: 'groove' } }))
    assert.isFalse(
      accepted({ border: { width: 5, color: '#000000', style: 'solid', image: 'url(x)' } })
    )
  })

  test('each style becomes the matching CSS', ({ assert }) => {
    const css = lookCss(
      textFrame({
        fill: 'primary',
        fillAlpha: 40,
        size: 13.5,
        family: 'serif',
        italic: true,
        caps: true,
        lineHeight: 120,
        tracking: 50,
        border: { width: 5, color: 'accent', style: 'dashed' },
        shadow: 'sm',
      })
    )
    assert.equal(css.background, 'color-mix(in srgb,var(--cv-primary) 40%,transparent)')
    assert.equal(css['font-size'], '13.5pt')
    assert.include(css['font-family'], 'Georgia')
    assert.equal(css['font-style'], 'italic')
    assert.equal(css['text-transform'], 'uppercase')
    assert.equal(css['line-height'], '1.2')
    assert.equal(css['letter-spacing'], '0.05em')
    assert.equal(css.border, '0.5mm dashed var(--cv-accent)')
    assert.property(css, 'box-shadow')
  })

  test('an exact size wins over the type scale; the brand font sets nothing', ({ assert }) => {
    const css = lookCss(textFrame({ font: 'xl', size: 11, family: 'brand' }))
    assert.equal(css['font-size'], '11pt')
    assert.notProperty(css, 'font-family')
  })
})
