import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Hash,
  Image as ImageIcon,
  Maximize2,
  Redo2,
  Sparkle,
  Square,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconButton } from '@/components/icon_button'
import { duplicateFrame, newFrame } from '../../../shared/canvas/ops.ts'
import { frameComponent } from '../../../shared/canvas/grapes.ts'
import type { FrameKind } from '../../../shared/canvas/model.ts'
import type { CanvasEditor } from './grapes/create_editor'
import { cvOf } from './grapes/create_editor'

const INSERT: { kind: FrameKind; label: string; icon: typeof Type }[] = [
  { kind: 'text', label: 'Add text', icon: Type },
  { kind: 'figure', label: 'Add a big number', icon: Hash },
  { kind: 'image', label: 'Add an image', icon: ImageIcon },
  { kind: 'shape', label: 'Add a shape', icon: Square },
  { kind: 'art', label: 'Add brand artwork', icon: Sparkle },
]

/** Insert, arrange and history actions for the canvas. */
export function CanvasToolbar({
  canvasEditor,
  hasFrame,
}: {
  canvasEditor: CanvasEditor | null
  hasFrame: boolean
}) {
  const [zoom, setZoom] = useState(100)
  const ed = canvasEditor
  const fit = () => ed?.fitZoom() ?? 100
  useEffect(() => {
    if (!ed) return
    const frame = requestAnimationFrame(() => setZoom(fit()))
    return () => cancelAnimationFrame(frame)
    // Fit once when the editor is ready; the user's zoom wins afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ed])
  useEffect(() => {
    ed?.setZoom(zoom)
  }, [ed, zoom])

  const insert = (kind: FrameKind) => {
    if (!ed) return
    const sheetCmp = ed.selectedSheet() ?? ed.sheets()[0]
    const sheet = ed.read().sheets.find((s) => s.id === sheetCmp?.getId())
    if (!sheetCmp || !sheet) return
    const frame = newFrame(kind, sheet, ed.taken())
    const [added] = sheetCmp.append(frameComponent(frame, 'px') as never)
    ed.editor.select(added)
  }

  const withFrame =
    (act: (cmp: NonNullable<ReturnType<CanvasEditor['selected']>>) => void) => () => {
      const cmp = ed?.selected()
      if (cmp) act(cmp)
    }

  const layer = (to: 'front' | 'back') =>
    withFrame((cmp) => {
      const zs = (cmp.parent()?.components().models ?? []).map((c) => cvOf(c)?.z ?? 0)
      ed!.updateFrame(cmp, (frame) => ({
        ...frame,
        z: to === 'front' ? Math.min(Math.max(...zs) + 1, 999) : 0,
      }))
      if (to === 'back')
        // Everything else moves up one so the frame is alone at the back.
        for (const other of cmp.parent()?.components().models ?? [])
          if (other !== cmp && cvOf(other))
            ed!.updateFrame(other, (frame) => ({ ...frame, z: Math.min(frame.z + 1, 999) }))
    })

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Canvas tools">
      {INSERT.map(({ kind, label, icon }) => (
        <IconButton
          key={kind}
          label={label}
          icon={icon}
          disabled={!ed}
          onClick={() => insert(kind)}
        />
      ))}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <IconButton
        label="Duplicate"
        icon={Copy}
        disabled={!hasFrame}
        onClick={withFrame((cmp) => {
          const sheet = ed!.read().sheets.find((s) => s.id === cmp.parent()?.getId())
          if (!sheet) return
          const [added] = cmp
            .parent()!
            .append(frameComponent(duplicateFrame(cvOf(cmp), sheet, ed!.taken()), 'px') as never)
          ed!.editor.select(added)
        })}
      />
      <IconButton
        label="Bring to front"
        icon={ArrowUpToLine}
        disabled={!hasFrame}
        onClick={layer('front')}
      />
      <IconButton
        label="Send to back"
        icon={ArrowDownToLine}
        disabled={!hasFrame}
        onClick={layer('back')}
      />
      <IconButton
        label="Delete"
        icon={Trash2}
        disabled={!hasFrame}
        onClick={withFrame((cmp) => {
          if (cvOf(cmp)?.locked) return
          cmp.remove()
        })}
      />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <IconButton
        label="Undo"
        icon={Undo2}
        disabled={!ed}
        onClick={() => ed?.editor.UndoManager.undo()}
      />
      <IconButton
        label="Redo"
        icon={Redo2}
        disabled={!ed}
        onClick={() => ed?.editor.UndoManager.redo()}
      />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <IconButton
        label="Zoom out"
        icon={ZoomOut}
        onClick={() => setZoom((z) => Math.max(30, z - 10))}
      />
      <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{zoom}%</span>
      <IconButton
        label="Zoom in"
        icon={ZoomIn}
        onClick={() => setZoom((z) => Math.min(200, z + 10))}
      />
      <IconButton label="Fit to width" icon={Maximize2} onClick={() => setZoom(fit())} />
    </div>
  )
}
