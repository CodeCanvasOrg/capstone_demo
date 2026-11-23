import { useRef } from 'react'

type Focus = { x: number; y: number }
const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

/**
 * Where a cropped picture stays in view: click or drag on the picture, or use
 * the arrow keys (5 %, 1 % with Alt). The marker is the point kept visible when
 * "Fill the box" crops it.
 */
export function FocalPoint({
  src,
  alt,
  focus,
  onChange,
}: {
  src: string
  alt: string
  focus: Focus
  onChange: (next: Focus) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const at = (event: React.PointerEvent) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return
    onChange({
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    })
  }

  const keys = (event: React.KeyboardEvent) => {
    const step = event.altKey ? 1 : 5
    const moves: Record<string, Focus> = {
      ArrowLeft: { x: focus.x - step, y: focus.y },
      ArrowRight: { x: focus.x + step, y: focus.y },
      ArrowUp: { x: focus.x, y: focus.y - step },
      ArrowDown: { x: focus.x, y: focus.y + step },
    }
    const next = moves[event.key]
    if (!next) return
    event.preventDefault()
    onChange({ x: clamp(next.x), y: clamp(next.y) })
  }

  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label="Focal point"
      aria-valuetext={`${focus.x}% across, ${focus.y}% down`}
      aria-valuenow={focus.x}
      aria-valuemin={0}
      aria-valuemax={100}
      onKeyDown={keys}
      onPointerDown={(event) => {
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        at(event)
      }}
      onPointerMove={(event) => dragging.current && at(event)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      className="relative inline-block max-w-full cursor-crosshair touch-none overflow-hidden rounded-md border bg-muted outline-offset-2 select-none focus-visible:outline-2 focus-visible:outline-ring"
    >
      <img src={src} alt={alt} draggable={false} className="block max-h-40 max-w-full" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,.6)]"
        style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
      />
    </div>
  )
}
