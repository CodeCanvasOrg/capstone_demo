import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { duplicateSheet, newSheet } from '../../../shared/canvas/ops.ts'
import { sheetComponent } from '../../../shared/canvas/grapes.ts'
import { LIMITS, type Sheet } from '../../../shared/canvas/model.ts'
import type { CanvasEditor } from './grapes/create_editor'

/**
 * Every sheet of the canvas, in order: select, add, duplicate, reorder, delete.
 * Sheets are rebuilt from their stored data when moved, so nothing depends on
 * GrapesJS keeping styles across a move.
 */
export function PageStrip({
  canvasEditor,
  sheetIds,
  selectedSheetId,
  onChange,
}: {
  canvasEditor: CanvasEditor | null
  sheetIds: string[]
  selectedSheetId: string | null
  onChange: () => void
}) {
  const ed = canvasEditor
  const wrapper = () => ed?.editor.getWrapper()
  const data = (id: string) => ed?.read().sheets.find((s) => s.id === id)
  const cmpOf = (id: string) => ed?.sheets().find((c) => c.getId() === id)

  const select = (id: string) => {
    const cmp = cmpOf(id)
    if (!cmp) return
    ed!.editor.select(cmp)
    cmp.getEl()?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const place = (sheet: Sheet, at: number) => {
    const [added] = wrapper()!.append(sheetComponent(sheet, 'px') as never, { at })
    onChange()
    queueMicrotask(() => select(added.getId()))
  }

  const add = (after: number) => {
    if (!ed || sheetIds.length >= LIMITS.sheets) return
    place(newSheet(ed.taken()), after + 1)
  }

  const duplicate = (id: string, index: number) => {
    const sheet = data(id)
    if (!ed || !sheet || sheetIds.length >= LIMITS.sheets) return
    place(duplicateSheet(sheet, ed.taken()), index + 1)
  }

  const move = (id: string, index: number, by: -1 | 1) => {
    const to = index + by
    const sheet = data(id)
    if (!ed || !sheet || to < 0 || to >= sheetIds.length) return
    cmpOf(id)?.remove()
    place(sheet, to)
  }

  const remove = (id: string) => {
    if (sheetIds.length <= 1) return
    cmpOf(id)?.remove()
    onChange()
  }

  return (
    <nav aria-label="Pages" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Pages
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {sheetIds.length} / {LIMITS.sheets}
        </span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {sheetIds.map((id, index) => (
          <li
            key={id}
            className={`group flex items-center gap-1.5 rounded-lg border p-1 ${
              id === selectedSheetId ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <button
              type="button"
              onClick={() => select(id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs whitespace-nowrap"
              aria-current={id === selectedSheetId ? 'page' : undefined}
              aria-label={`Page ${index + 1}`}
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-6.5 shrink-0 items-center justify-center rounded-sm border bg-white text-[10px] text-muted-foreground shadow-xs"
              >
                {index + 1}
              </span>
              <span className="truncate">Page {index + 1}</span>
            </button>
            <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              {(
                [
                  [`Move page ${index + 1} up`, ArrowUp, index === 0, () => move(id, index, -1)],
                  [
                    `Move page ${index + 1} down`,
                    ArrowDown,
                    index === sheetIds.length - 1,
                    () => move(id, index, 1),
                  ],
                  [`Duplicate page ${index + 1}`, Copy, false, () => duplicate(id, index)],
                  [`Delete page ${index + 1}`, Trash2, sheetIds.length <= 1, () => remove(id)],
                ] as const
              ).map(([label, icon, disabled, run]) => (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={label}
                  title={label}
                  disabled={disabled}
                  onClick={run}
                >
                  {(() => {
                    const Icon = icon
                    return <Icon aria-hidden="true" />
                  })()}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!ed || sheetIds.length >= LIMITS.sheets}
        onClick={() =>
          add(
            sheetIds.indexOf(selectedSheetId ?? '') >= 0
              ? sheetIds.indexOf(selectedSheetId!)
              : sheetIds.length - 1
          )
        }
      >
        <Plus aria-hidden="true" /> Add page
      </Button>
    </nav>
  )
}
