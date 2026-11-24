import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown_menu'
import { ACADEMIC_DESIGNS, PLANNABLE_DESIGN_IDS } from '../../../shared/canvas/academic/designs.ts'
import type { RunPage } from './generation'
import { PageQualityBadge } from './page_quality_badge'
import { duplicateSheet, newSheet } from '../../../shared/canvas/ops.ts'
import { sheetComponent } from '../../../shared/canvas/grapes.ts'
import { LIMITS, type Sheet } from '../../../shared/canvas/model.ts'
import type { CanvasEditor } from './grapes/create_editor'

/**
 * Every sheet of the canvas, in order: select, add, duplicate, reorder, delete.
 * Sheets are rebuilt from their stored data when moved, so nothing depends on
 * GrapesJS keeping styles across a move.
 */
export type PageAction = 'rewrite' | 'expand' | 'condense'

export function PageStrip({
  canvasEditor,
  sheetIds,
  selectedSheetId,
  onChange,
  generated,
  onAction,
  onDesign,
  actionsBlocked,
}: {
  canvasEditor: CanvasEditor | null
  sheetIds: string[]
  selectedSheetId: string | null
  onChange: () => void
  /** The latest run's pages, by position, when they still line up with the sheets. */
  generated?: RunPage[] | null
  /** Rewrite, deepen or shorten a generated page. */
  onAction?: (index: number, action: PageAction) => void
  /** Lay a generated page out in another design. */
  onDesign?: (index: number, design: string) => void
  /** Why the page actions are unavailable right now (unsaved edits, a run in progress). */
  actionsBlocked?: string | null
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
            className={`group flex flex-col gap-1 rounded-lg border p-1 ${
              id === selectedSheetId ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="flex items-center gap-1.5">
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
                <span className="truncate">
                  Page {index + 1}
                  {generated?.[index] && (
                    <span className="text-muted-foreground">
                      {' · '}
                      {generated[index].design.replaceAll('_', ' ')}
                    </span>
                  )}
                </span>
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
                {generated?.[index] &&
                  onAction &&
                  onDesign &&
                  !['contents', 'references'].includes(generated[index].design) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Page ${index + 1} actions`}
                          title="Page actions"
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                          {actionsBlocked ?? 'Generated page'}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(
                          [
                            ['rewrite', 'Rewrite page'],
                            ['expand', 'Add depth'],
                            ['condense', 'Make shorter'],
                          ] as const
                        ).map(([action, label]) => (
                          <DropdownMenuItem
                            key={action}
                            disabled={!!actionsBlocked}
                            onSelect={() => onAction(index, action)}
                          >
                            {label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger disabled={!!actionsBlocked}>
                            Change design
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-52">
                            {PLANNABLE_DESIGN_IDS.map((design) => (
                              <DropdownMenuItem
                                key={design}
                                disabled={design === generated[index].design}
                                onSelect={() => onDesign(index, design)}
                              >
                                {ACADEMIC_DESIGNS[design].label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
              </div>
            </div>
            {generated?.[index] && <PageQualityBadge page={generated[index]} />}
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
