import { test } from '@japa/runner'
import { grapesjs } from 'grapesjs'
import { fromGrapes, toGrapes, type GrapesProject } from '../../shared/canvas/grapes.ts'
import { parseCanvas } from '../../shared/canvas/model.ts'
import { canvasTypes } from '../../shared/canvas/grapes_types.ts'
import { minimal } from '../fixtures/canvas/index.ts'

/** A component by id (headless GrapesJS has no DOM for `find('#id')`). */
function byId(editor: any, id: string): any {
  const walk = (cmp: any): any =>
    cmp.getAttributes().id === id ? cmp : cmp.components().map(walk).find(Boolean)
  return walk(editor.getWrapper())
}

/** Loads a project into a real, headless GrapesJS editor and reads it back. */
function throughEditor(project: GrapesProject, edit?: (editor: any) => void): GrapesProject {
  const editor = grapesjs.init({
    headless: true,
    storageManager: false,
    avoidInlineStyle: true,
    plugins: [canvasTypes],
    projectData: project,
  } as any)
  edit?.(editor)
  const data = editor.getProjectData() as GrapesProject
  editor.destroy()
  return data
}

test.group('canvas ⇄ GrapesJS', () => {
  test('a canvas survives the round trip as plain JSON', ({ assert }) => {
    const parsed = parseCanvas(fromGrapes(toGrapes(minimal())))
    assert.isTrue(parsed.ok)
    if (parsed.ok) assert.deepEqual(parsed.canvas, minimal())
  })

  test('a canvas survives a real GrapesJS editor load and save', ({ assert }) => {
    const parsed = parseCanvas(fromGrapes(throughEditor(toGrapes(minimal()))))
    assert.isTrue(parsed.ok, parsed.ok ? '' : JSON.stringify(parsed.problems))
    if (parsed.ok) assert.deepEqual(parsed.canvas, minimal())
  })

  test('the live editor works in px and still reads back exact mm', ({ assert }) => {
    const parsed = parseCanvas(fromGrapes(throughEditor(toGrapes(minimal(), 'px'))))
    assert.isTrue(parsed.ok)
    if (parsed.ok) assert.deepEqual(parsed.canvas, minimal())
  })

  test('a drag in the editor is read back as the new position, in mm', ({ assert }) => {
    const data = throughEditor(toGrapes(minimal()), (editor) => {
      const frame = byId(editor, 's0-f0')
      frame.addStyle({ left: '30mm', top: '45.5mm', width: '90mm' })
    })
    const parsed = parseCanvas(fromGrapes(data))
    assert.isTrue(parsed.ok)
    if (parsed.ok)
      assert.deepEqual(parsed.canvas.sheets[0].frames[0].geo, { x: 300, y: 455, w: 900, h: 400 })
  })

  test('a position written in px is converted to mm', ({ assert }) => {
    const data = throughEditor(toGrapes(minimal()), (editor) => {
      byId(editor, 's0-f1').addStyle({ left: '113.385826px' })
    })
    const parsed = parseCanvas(fromGrapes(data))
    if (parsed.ok) assert.equal(parsed.canvas.sheets[0].frames[1].geo.x, 300)
  })

  test('a frame dragged off the sheet is pulled back inside', ({ assert }) => {
    const data = throughEditor(toGrapes(minimal()), (editor) => {
      byId(editor, 's0-f0').addStyle({ left: '200mm' })
    })
    const parsed = parseCanvas(fromGrapes(data))
    assert.isTrue(parsed.ok)
    if (parsed.ok) assert.equal(parsed.canvas.sheets[0].frames[0].geo.x, 2100 - 800)
  })

  test('components the editor added outside the catalog are ignored', ({ assert }) => {
    const data = throughEditor(toGrapes(minimal()), (editor) => {
      byId(editor, 's0').append({ type: 'text', content: 'stray' })
      editor.getWrapper().append({ tagName: 'script', content: 'alert(1)' })
    })
    const parsed = parseCanvas(fromGrapes(data))
    assert.isTrue(parsed.ok)
    if (parsed.ok) assert.deepEqual(parsed.canvas, minimal())
  })

  test('the editor draws frames at the stored mm positions', ({ assert }) => {
    const editor = grapesjs.init({
      headless: true,
      storageManager: false,
      avoidInlineStyle: true,
      plugins: [canvasTypes],
      projectData: toGrapes(minimal()),
    } as any)
    const css = editor.getCss() ?? ''
    editor.destroy()
    assert.include(css, '#s0-f0{')
    assert.match(css, /#s0-f0\{[^}]*left:20mm/)
    assert.match(css, /#s0-f0\{[^}]*top:30mm/)
    assert.match(css, /#s0-f0\{[^}]*width:80mm/)
  })
})
