import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BROCHURE_TEMPLATES,
  DESIGNS,
  DESIGN_IDS,
  MAX_BROCHURE_PAGES,
  reviewSelection,
  templateSelection,
  type BrochureSelection,
  type PageDesign,
} from '../../../shared/brochure/designs.ts'
import { DesignThumb } from './design_thumb'

const AUTO = 'auto'

/**
 * Chooses the design of every page of a brochure. Each page takes one of the nine
 * designs, or "Let AI choose" to have the model pick the one that fits the project.
 * A full template is a starting point: it fills the list, which can then be edited.
 */
export function PageDesigner({
  value,
  onChange,
  disabled = false,
}: {
  value: BrochureSelection
  onChange: (next: BrochureSelection) => void
  disabled?: boolean
}) {
  const { pages } = value
  const set = (next: PageDesign[]) => onChange({ source: 'custom', pages: next })
  const move = (index: number, by: -1 | 1) => {
    const to = index + by
    if (to < 0 || to >= pages.length) return
    const next = [...pages]
    ;[next[index], next[to]] = [next[to], next[index]]
    set(next)
  }
  const notes = reviewSelection(value)
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="brochure-start" className="text-xs font-semibold">
          Start from a template
        </label>
        <select
          id="brochure-start"
          className="h-8 rounded-md border bg-background px-2 text-xs"
          disabled={disabled}
          value={value.source === 'template' ? (value.template ?? '') : ''}
          onChange={(event) => {
            const next = event.target.value ? templateSelection(event.target.value) : undefined
            if (next) onChange(next)
          }}
        >
          <option value="">Your own pages</option>
          {BROCHURE_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label} ({template.pages.length} pages)
            </option>
          ))}
        </select>
      </div>

      <ol aria-label="Pages" className="min-w-0 divide-y rounded-xl border bg-card">
        {pages.map((design, index) => (
          <li
            key={index}
            className="pf-enter flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
          >
            <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <span className="w-10 shrink-0">
              {design === AUTO ? (
                <span className="bd-thumb grid place-items-center bg-muted">
                  <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
                </span>
              ) : (
                <DesignThumb design={design} />
              )}
            </span>
            <div className="min-w-[9rem] flex-1">
              <label htmlFor={`design-${index}`} className="sr-only">
                Design for page {index + 1}
              </label>
              <select
                id={`design-${index}`}
                className="h-8 w-full rounded-md border bg-background px-2 text-xs font-medium"
                disabled={disabled}
                value={design}
                onChange={(event) =>
                  set(
                    pages.map((page, i) =>
                      i === index ? (event.target.value as PageDesign) : page
                    )
                  )
                }
              >
                <option value={AUTO}>Let AI choose</option>
                {DESIGN_IDS.map((id) => (
                  <option key={id} value={id}>
                    {DESIGNS[id].label}
                  </option>
                ))}
              </select>
              <p className="mt-1 line-clamp-1 text-[.7rem] text-muted-foreground">
                {design === AUTO
                  ? 'The AI picks the design that fits this project and the pages around it.'
                  : DESIGNS[design].description}
              </p>
            </div>
            <div className="ml-auto flex shrink-0 gap-0.5">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Move page ${index + 1} up`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Move page ${index + 1} down`}
                disabled={disabled || index === pages.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove page ${index + 1}`}
                disabled={disabled || pages.length === 1}
                onClick={() => set(pages.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || pages.length >= MAX_BROCHURE_PAGES}
          onClick={() => set([...pages, AUTO])}
        >
          <Plus aria-hidden="true" />
          Add a page
        </Button>
        <span className="text-xs text-muted-foreground">
          {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </span>
      </div>
      {notes.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
