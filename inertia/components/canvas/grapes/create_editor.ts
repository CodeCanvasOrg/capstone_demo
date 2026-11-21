import type { Component, Editor } from 'grapesjs'
import {
  CANVAS_BASE_CSS,
  brandVars,
  declarations,
  frameCss,
  sheetCss,
} from '../../../../shared/canvas/css.ts'
import { geoFrom, toGrapes, fromGrapes, SHEET_TYPE } from '../../../../shared/canvas/grapes.ts'
import { canvasTypes, FRAME_KINDS } from '../../../../shared/canvas/grapes_types.ts'
import { snapGeo } from '../../../../shared/canvas/geometry.ts'
import type { CanvasDocument, Frame, Sheet } from '../../../../shared/canvas/model.ts'
import type { BrandKit } from '../../../../shared/layout/brand.ts'
import { frameHtml } from './frame_html'
import { startTextEditing, type TextEditing } from './text_editing'

/**
 * Everything that touches GrapesJS lives in this folder. The React editor only
 * talks to the `CanvasEditor` returned here, so a GrapesJS upgrade stays local.
 */
export type CanvasEditorOptions = {
  container: HTMLElement
  canvas: CanvasDocument
  brand: Pick<BrandKit, 'palette'> & { fonts: string[] }
  imageUrl: (imageId: string) => string
  onChange: () => void
  onSelect: (frame: Frame | null, sheetId: string | null) => void
  onOverflow: (frameIds: string[]) => void
  onTextEditing: (editing: TextEditing | null) => void
}

const EDITOR_CSS = `
html,body{background:#e7e5e4;margin:0}
body{padding:24px 24px 64px;font-family:var(--cv-font),Arial,sans-serif;color:var(--cv-text);font-size:9.5pt}
.cv-sheet{margin:0 auto 32px;box-shadow:0 1px 2px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.08)}
.cv-frame{cursor:default}
.cv-frame.cv-overflow{outline:2px dashed #dc2626!important;outline-offset:-2px}
.cv-frame.cv-editing{outline:2px solid #2563eb!important;cursor:text}
.cv-frame .ProseMirror{outline:none;min-height:100%}
.cv-image-empty{display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:repeating-linear-gradient(45deg,#f5f5f4 0 8px,#e7e5e4 8px 16px);color:#78716c;font-size:9pt}
.cv-art-ribbons{width:100%;height:100%;background:repeating-linear-gradient(160deg,transparent 0 9px,color-mix(in srgb,var(--cv-accent) 30%,transparent) 9px 10px)}
.tiptap-source-citation{display:inline-block;padding:0 4px;margin:0 1px;border-radius:3px;background:color-mix(in srgb,var(--cv-accent) 25%,transparent);font-size:.75em;vertical-align:super;line-height:1.2}
`

/** Our stored data on a component. */
export const cvOf = <T = Frame>(cmp: Component) => cmp.get('cv') as T
const isFrame = (cmp?: Component | null) =>
  !!cmp && String(cmp.get('type')).startsWith('cv-') && cmp.get('type') !== SHEET_TYPE

function viewsPlugin(imageUrl: CanvasEditorOptions['imageUrl']) {
  return (editor: Editor) => {
    for (const kind of FRAME_KINDS)
      editor.Components.addType(`cv-${kind}`, {
        view: {
          init() {
            this.listenTo(this.model, 'change:cv', this.render)
          },
          onRender({ el, model }) {
            const frame = model.get('cv') as Frame | null
            if (frame) el.innerHTML = frameHtml(frame, imageUrl)
          },
        },
      })
  }
}

const FRAME_DRAG = `[data-cv-type="${SHEET_TYPE}"]`
/** One A4 sheet (210 mm at 96 dpi) plus the canvas margin either side. */
const FRAME_WIDTH = Math.ceil((210 * 96) / 25.4) + 48

/** A locked frame cannot be moved, resized or removed in the canvas. */
function lockState(cmp: Component, frame: Frame) {
  cmp.set({
    draggable: frame.locked ? false : FRAME_DRAG,
    resizable: frame.locked ? false : { ratioDefault: frame.kind === 'image' },
    removable: !frame.locked,
  })
}

export type CanvasEditor = ReturnType<typeof createCanvasEditor>

export function createCanvasEditor(
  grapesjs: typeof import('grapesjs').default,
  o: CanvasEditorOptions
) {
  const vars = {
    ...brandVars({ palette: o.brand.palette }),
    '--cv-font': `"${o.brand.fonts[0] ?? 'Inter'}"`,
  }
  const editor = grapesjs.init({
    container: o.container,
    height: '100%',
    width: 'auto',
    fromElement: false,
    storageManager: false,
    dragMode: 'absolute',
    avoidInlineStyle: true,
    selectorManager: { componentFirst: true },
    // No GrapesJS chrome at all: every panel is our own React UI.
    panels: { defaults: [] },
    blockManager: { custom: true },
    styleManager: { custom: true },
    layerManager: { custom: true },
    traitManager: { custom: true },
    showOffsets: false,
    canvasCss: `:root{${declarations(vars)}}${CANVAS_BASE_CSS}${EDITOR_CSS}`,
    protectedCss: '*{box-sizing:border-box}',
    parser: {
      optionsHtml: { allowScripts: false, allowUnsafeAttr: false, allowUnsafeAttrValue: false },
    },
    plugins: [canvasTypes as never, viewsPlugin(o.imageUrl)],
    projectData: toGrapes(o.canvas, 'px'),
  } as never) as Editor

  let syncing = false
  let editing: TextEditing | null = null

  /** Writes stored data back to a component and redraws its CSS from it, in mm. */
  const write = (cmp: Component, frame: Frame) => {
    syncing = true
    try {
      cmp.set('cv', frame)
      cmp.setStyle(frameCss(frame, 'px'))
      lockState(cmp, frame)
    } finally {
      syncing = false
    }
  }

  /** After a drag or resize: GrapesJS wrote px; snap, clamp and store in mm. */
  const syncGeometry = (cmp?: Component) => {
    if (syncing || !isFrame(cmp)) return
    const frame = cvOf(cmp!)
    const others = (cmp!.parent()?.components().models ?? [])
      .filter((c) => c !== cmp && isFrame(c))
      .map((c) => cvOf(c).geo)
    const z = Number.parseInt(String(cmp!.getStyle()['z-index'] ?? frame.z), 10)
    const geo = snapGeo(geoFrom(cmp!.getStyle() as Record<string, string>, frame.geo), others)
    write(cmp!, { ...frame, geo, z: Number.isFinite(z) ? z : frame.z })
    checkOverflow()
    o.onSelect(cvOf(cmp!), cmp!.parent()?.getId() ?? null)
  }

  editor.on('component:drag:end', (event: { target?: Component }) => syncGeometry(event?.target))
  editor.on('component:resize:end', () => syncGeometry(editor.getSelected()))

  const selectedSheet = () => {
    const selected = editor.getSelected()
    if (!selected) return null
    return selected.get('type') === SHEET_TYPE ? selected : selected.parent()
  }

  editor.on('component:toggled', () => {
    const selected = editor.getSelected()
    if (editing && editing.component !== selected) stopEditing()
    o.onSelect(isFrame(selected) ? cvOf(selected!) : null, selectedSheet()?.getId() ?? null)
  })

  // Undo and redo change stored data under the selection; tell the UI.
  editor.on('undo redo', () => {
    const selected = editor.getSelected()
    o.onSelect(isFrame(selected) ? cvOf(selected!) : null, selectedSheet()?.getId() ?? null)
    setTimeout(checkOverflow, 0)
  })

  editor.on('update', () => {
    if (!syncing) o.onChange()
  })

  /** Text frames whose text runs past their box, marked in the canvas and reported. */
  const checkOverflow = () => {
    const over: string[] = []
    editor
      .getWrapper()
      ?.find('.cv-text')
      .forEach((cmp) => {
        const el = cmp.getEl()
        if (!el) return
        const overflowing = el.scrollHeight > el.clientHeight + 1
        el.classList.toggle('cv-overflow', overflowing)
        if (overflowing) over.push(cmp.getId())
      })
    o.onOverflow(over)
  }

  const stopEditing = () => {
    if (!editing) return
    const done = editing
    editing = null
    const doc = done.finish()
    const frame = cvOf(done.component)
    lockState(done.component, cvOf(done.component))
    if (JSON.stringify(frame.kind === 'text' ? frame.doc : null) !== JSON.stringify(doc))
      done.component.set('cv', { ...frame, doc })
    else done.component.view?.render()
    o.onTextEditing(null)
    checkOverflow()
    o.onChange()
  }

  editor.onReady(() => {
    editor
      .getWrapper()
      ?.find('.cv-frame')
      .forEach((cmp) => cvOf(cmp) && lockState(cmp, cvOf(cmp)))
  })

  const attached = new WeakSet<Document>()
  /** Canvas listeners, once per iframe document (the frame may load before we listen). */
  const attach = () => {
    const doc = editor.Canvas.getDocument()
    if (!doc || attached.has(doc)) return
    attached.add(doc)
    const editText = (target: HTMLElement, cmp: Component) => {
      cmp.set({ draggable: false })
      editing = startTextEditing(target, cmp, cvOf(cmp), {
        onUpdate: checkOverflow,
        onExit: stopEditing,
      })
      o.onTextEditing(editing)
    }

    // Press and drag a frame to move it, as in a design tool (GrapesJS only starts
    // an absolute drag from its toolbar handle by default). A second press on a
    // text frame edits its text: a drag on the first press would swallow `dblclick`.
    doc.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || editing) return
      if (event.detail >= 2) {
        // The first press started a drag, which briefly takes pointer events off the
        // frame, so the second press is matched to the selected frame by position.
        const selected = editor.getSelected()
        const el = selected?.getEl()
        const box = el?.getBoundingClientRect()
        const inside =
          box &&
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom
        if (
          selected &&
          el &&
          inside &&
          el.classList.contains('cv-text') &&
          !cvOf(selected).locked
        ) {
          event.preventDefault()
          editText(el, selected)
        }
        return
      }
      const target = (event.target as HTMLElement).closest('.cv-frame') as HTMLElement | null
      if (!target?.id) return
      const cmp = editor.getWrapper()?.find(`#${target.id}`).at(0)
      if (!cmp) return
      if (!cmp.get('draggable')) return
      if (editor.getSelected() !== cmp) editor.select(cmp)
      editor.runCommand('tlb-move', { target: cmp, event })
    })
    setTimeout(checkOverflow, 50)
  }
  editor.on('canvas:frame:load', attach)
  editor.onReady(attach)

  const taken = () => {
    const ids = new Set<string>()
    for (const sheet of read().sheets) {
      ids.add(sheet.id)
      sheet.frames.forEach((f) => ids.add(f.id))
    }
    return ids
  }

  /** The canvas as stored, candidate only: callers validate with parseCanvas. */
  const read = () => fromGrapes(editor.getProjectData() as never) as CanvasDocument

  const sheets = () =>
    (editor.getWrapper()?.components().models ?? []).filter((c) => c.get('type') === SHEET_TYPE)

  /**
   * Zoom scales the whole frame, so the frame is sized to one sheet wide and to the
   * column's height divided by the zoom: scaled, it fills the column exactly and
   * scrolls inside, at any zoom.
   */
  const setZoom = (percent: number) => {
    const height = o.container.clientHeight || 800
    const size = {
      width: `${FRAME_WIDTH}px`,
      height: `${Math.round(height / (percent / 100))}px`,
    }
    const device = editor.Devices.get('sheet')
    if (device) device.set(size)
    else editor.Devices.add({ id: 'sheet', name: 'Sheet', ...size })
    editor.setDevice('sheet')
    editor.Canvas.setZoom(percent)
    editor.refresh()
    requestAnimationFrame(() => align())
  }

  /**
   * Puts the frame at the top of the column, centred. GrapesJS scales and offsets
   * the frame on its own, so measure and correct (its zoom transition is turned off
   * in app.css, so one correction normally settles it).
   */
  const align = (attempt = 0) => {
    const frameEl = editor.Canvas.getFrameEl()
    if (!frameEl) return
    const column = o.container.getBoundingClientRect()
    const frameBox = frameEl.getBoundingClientRect()
    const dx = column.left + (column.width - frameBox.width) / 2 - frameBox.left
    const dy = column.top - frameBox.top
    if ((Math.abs(dx) < 1 && Math.abs(dy) < 1) || attempt > 3) return
    const { x, y } = editor.Canvas.getCoords()
    editor.Canvas.setCoords(x + dx, y + dy)
    requestAnimationFrame(() => align(attempt + 1))
  }

  /** The zoom at which a sheet fills the column width. */
  const fitZoom = () => {
    const width = o.container.clientWidth
    return width ? Math.max(30, Math.min(150, Math.floor(((width - 72) / FRAME_WIDTH) * 100))) : 100
  }

  return {
    editor,
    read,
    setZoom,
    fitZoom,
    taken,
    sheets,
    selectedSheet,
    stopEditing,
    checkOverflow,
    selected: () => {
      const s = editor.getSelected()
      return isFrame(s) ? s! : null
    },
    find: (id: string) => editor.getWrapper()?.find(`#${id}`).at(0) ?? null,
    updateFrame(cmp: Component, patch: (frame: Frame) => Frame) {
      write(cmp, patch(cvOf(cmp)))
      editor.trigger('update')
      checkOverflow()
      o.onSelect(cvOf(cmp), cmp.parent()?.getId() ?? null)
    },
    updateSheet(
      cmp: Component,
      patch: (sheet: Pick<Sheet, 'id' | 'background'>) => Pick<Sheet, 'id' | 'background'>
    ) {
      const next = patch(cvOf<Pick<Sheet, 'id' | 'background'>>(cmp))
      cmp.set('cv', next)
      cmp.setStyle(sheetCss(next))
      editor.trigger('update')
    },
    destroy() {
      stopEditing()
      editor.destroy()
    },
  }
}
