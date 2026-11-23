import type { Component, Editor } from 'grapesjs'
import {
  CANVAS_BASE_CSS,
  brandVars,
  declarations,
  frameCss,
  sheetCss,
} from '../../../../shared/canvas/css.ts'
import {
  frameComponent,
  geoFrom,
  toGrapes,
  fromGrapes,
  SHEET_TYPE,
} from '../../../../shared/canvas/grapes.ts'
import { canvasTypes, FRAME_KINDS } from '../../../../shared/canvas/grapes_types.ts'
import { clampGeo, fromPx, snapGeo, toPx } from '../../../../shared/canvas/geometry.ts'
import { DEFAULT_SIZE, newFrame } from '../../../../shared/canvas/ops.ts'
import type { CanvasDocument, Frame, FrameKind, Sheet } from '../../../../shared/canvas/model.ts'
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
body.cv-placing,body.cv-placing .cv-frame{cursor:crosshair!important}
.cv-ghost{position:absolute;border:1.5px dashed #2563eb;background:rgba(37,99,235,.06);pointer-events:none;z-index:1000}
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
/** Screen pixels the pointer must travel before a press becomes a drag. */
export const DRAG_THRESHOLD_PX = 4
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}
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
    // GrapesJS's guides already align edges while dragging; snapping edges again after
    // release made the frame jump. Only round to half a millimetre.
    const geo = snapGeo(geoFrom(cmp!.getStyle() as Record<string, string>, frame.geo), others, {
      grid: 5,
      threshold: 0,
    })
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

  let destroyed = false
  editor.on('update', () => {
    if (!syncing && !destroyed) o.onChange()
  })
  // A deleted box or page must always reach the autosaved draft, and so the preview.
  editor.on('component:remove', () => {
    if (!syncing && !destroyed) o.onChange()
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
    // The inspector holds a copy of the frame: give it the new text, or its next
    // change would write the old text back.
    if (editor.getSelected() === done.component)
      o.onSelect(cvOf(done.component), done.component.parent()?.getId() ?? null)
    o.onChange()
  }

  editor.onReady(() => {
    editor
      .getWrapper()
      ?.find('.cv-frame')
      .forEach((cmp) => cvOf(cmp) && lockState(cmp, cvOf(cmp)))
  })

  const editText = (target: HTMLElement, cmp: Component, selectAll = false) => {
    if (editing) stopEditing()
    cmp.set({ draggable: false })
    editing = startTextEditing(target, cmp, cvOf(cmp), {
      onUpdate: checkOverflow,
      onExit: stopEditing,
      selectAll,
    })
    o.onTextEditing(editing)
  }

  /** Edits the selected text box, if it is one (Enter, or the inspector's button). */
  const editSelected = () => {
    const cmp = editor.getSelected()
    const el = cmp?.getEl()
    if (!cmp || !el || !isFrame(cmp) || cvOf(cmp).kind !== 'text' || cvOf(cmp).locked) return false
    editText(el, cmp)
    return true
  }

  /**
   * Placing a new box, as in a design tool: after choosing a kind, click on a page
   * to drop it at its default size, or drag to draw it at the size you want.
   */
  let placing: { kind: FrameKind; onEnd: () => void } | null = null
  let drawing: { sheetEl: HTMLElement; x: number; y: number; ghost: HTMLElement } | null = null
  const setPlacing = (next: typeof placing) => {
    placing?.onEnd()
    placing = next
    editor.Canvas.getBody()?.classList.toggle('cv-placing', Boolean(next))
  }
  const sheetPoint = (sheetEl: HTMLElement, event: MouseEvent) => {
    const box = sheetEl.getBoundingClientRect()
    return { x: fromPx(event.clientX - box.left), y: fromPx(event.clientY - box.top) }
  }
  const finishPlacing = (event: MouseEvent) => {
    if (!drawing || !placing) return
    const { sheetEl, x, y, ghost } = drawing
    ghost.remove()
    drawing = null
    const kind = placing.kind
    setPlacing(null)
    const sheetCmp = sheets().find((c) => c.getId() === sheetEl.id)
    const sheet = read().sheets.find((s) => s.id === sheetEl.id)
    if (!sheetCmp || !sheet) return
    const end = sheetPoint(sheetEl, event)
    const dragged = Math.abs(end.x - x) >= 50 && Math.abs(end.y - y) >= 50
    const size = DEFAULT_SIZE[kind]
    const geo = clampGeo(
      dragged
        ? {
            x: Math.min(x, end.x),
            y: Math.min(y, end.y),
            w: Math.abs(end.x - x),
            h: Math.abs(end.y - y),
          }
        : { x, y, ...size }
    )
    const frame = { ...newFrame(kind, sheet, taken()), geo }
    if (frame.kind === 'text')
      frame.doc = [{ type: 'paragraph', content: [{ type: 'text', text: 'Type here' }] }]
    const [added] = sheetCmp.append(frameComponent(frame, 'px') as never)
    lockState(added, frame)
    editor.select(added)
    o.onChange()
    if (frame.kind === 'text')
      requestAnimationFrame(() => {
        const el = added.getEl()
        if (el) editText(el, added, true)
      })
  }

  /** Keyboard nudging: precise moves without the mouse. */
  const nudge = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && placing) {
      drawing?.ghost.remove()
      drawing = null
      setPlacing(null)
      return
    }
    if (event.key === 'Enter' && !editing && editSelected()) {
      event.preventDefault()
      return
    }
    const dir = ARROWS[event.key]
    if (!dir || editing || event.altKey || event.metaKey || event.ctrlKey) return
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
    const cmp = editor.getSelected()
    if (!isFrame(cmp) || cvOf(cmp!).locked) return
    event.preventDefault()
    const step = event.shiftKey ? 100 : 10
    const frame = cvOf(cmp!)
    write(cmp!, {
      ...frame,
      geo: clampGeo({
        ...frame.geo,
        x: frame.geo.x + dir[0] * step,
        y: frame.geo.y + dir[1] * step,
      }),
    })
    editor.trigger('update')
    o.onSelect(cvOf(cmp!), cmp!.parent()?.getId() ?? null)
    o.onChange()
  }

  // Esc cancels placing even when focus is outside the canvas (e.g. on the toolbar).
  const escapeOutside = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && placing) nudge(event)
  }
  window.addEventListener('keydown', escapeOutside)

  const attached = new WeakSet<Document>()
  /** Canvas listeners, once per iframe document (the frame may load before we listen). */
  const attach = () => {
    const doc = editor.Canvas.getDocument()
    if (!doc || attached.has(doc)) return
    attached.add(doc)

    // Press and drag a frame to move it, as in a design tool. GrapesJS starts a drag
    // on the press itself, so the slightest hand movement during a click moved the
    // frame. Like design tools, the drag only starts once the pointer has travelled
    // past a small threshold (in screen pixels, whatever the zoom); a shorter press
    // is a click that selects. The drag is then handed to GrapesJS with the original
    // press, so the frame keeps its offset from the pointer.
    let pending: { cmp: Component; down: MouseEvent } | null = null
    // Placing a box: capture the press before GrapesJS sees it, and swallow the click
    // that follows, which would otherwise select the page instead of the new box.
    let swallowClick = false
    doc.addEventListener(
      'mousedown',
      (event) => {
        swallowClick = false
        if (!placing || event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        const sheetEl = (event.target as HTMLElement).closest('.cv-sheet') as HTMLElement | null
        if (!sheetEl) return
        const start = sheetPoint(sheetEl, event)
        const ghost = doc.createElement('div')
        ghost.className = 'cv-ghost'
        sheetEl.append(ghost)
        drawing = { sheetEl, ...start, ghost }
      },
      true
    )
    doc.addEventListener(
      'click',
      (event) => {
        if (!swallowClick) return
        swallowClick = false
        event.stopPropagation()
        event.preventDefault()
      },
      true
    )
    doc.addEventListener('mousedown', (event) => {
      pending = null
      if (event.button !== 0) return
      if (editing) {
        // A press outside the box being edited ends editing; inside, Tiptap has it.
        const el = editing.component.getEl()
        if (el?.contains(event.target as Node)) return
        stopEditing()
      }
      if (event.detail >= 2) {
        // Second press: edit the selected text frame under the pointer.
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
      if (editor.getSelected() !== cmp) editor.select(cmp)
      if (!cmp.get('draggable')) return
      // No text selection while the pointer moves towards the threshold.
      event.preventDefault()
      pending = { cmp, down: event }
    })
    doc.addEventListener('mousemove', (event) => {
      if (drawing) {
        const end = sheetPoint(drawing.sheetEl, event)
        const g = drawing.ghost.style
        g.left = `${toPx(Math.min(drawing.x, end.x))}px`
        g.top = `${toPx(Math.min(drawing.y, end.y))}px`
        g.width = `${toPx(Math.abs(end.x - drawing.x))}px`
        g.height = `${toPx(Math.abs(end.y - drawing.y))}px`
        return
      }
      if (!pending) return
      if (event.buttons === 0) {
        pending = null
        return
      }
      // Canvas pixels are scaled by the zoom on screen.
      const zoom = editor.Canvas.getZoom() / 100
      const moved = Math.hypot(
        event.clientX - pending.down.clientX,
        event.clientY - pending.down.clientY
      )
      if (moved * zoom < DRAG_THRESHOLD_PX) return
      const { cmp, down } = pending
      pending = null
      editor.runCommand('tlb-move', { target: cmp, event: down })
    })
    doc.addEventListener('mouseup', (event) => {
      pending = null
      if (drawing) {
        swallowClick = true
        finishPlacing(event)
      }
    })

    // Arrow keys nudge the selected frame 1 mm, or 10 mm with Shift.
    doc.addEventListener('keydown', nudge)
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
    editSelected,
    /** Starts placing a new box; `onEnd` runs when it is placed or cancelled. */
    place: (kind: FrameKind, onEnd: () => void) => setPlacing({ kind, onEnd }),
    cancelPlacing: () => setPlacing(null),
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
      destroyed = true
      window.removeEventListener('keydown', escapeOutside)
      setPlacing(null)
      stopEditing()
      editor.destroy()
    },
  }
}
