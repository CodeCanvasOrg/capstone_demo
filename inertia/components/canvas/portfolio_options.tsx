import { Switch } from '@/components/ui/switch'
import type { Depth } from '../../../shared/canvas/options.ts'
import type { GenerationOptions } from './generation'

/** Rows an entry carries at each depth (the template shows three to eight). */
const DEPTHS: { value: Depth; label: string; hint: string }[] = [
  { value: 'concise', label: 'Concise', hint: '4 to 5 rows an entry' },
  { value: 'standard', label: 'Standard', hint: '6 to 7 rows an entry' },
  { value: 'detailed', label: 'Detailed', hint: '8 rows an entry' },
]

const ENTRY_CHOICES = ['auto', 1, 2, 3, 4, 5, 6] as const

/** Pressed 0.97 in 160 ms ease-out; hover only on devices that hover; still for reduced motion. */
const radio =
  'flex flex-1 flex-col gap-0.5 rounded-lg border p-2.5 text-left text-sm outline-none transition-[transform,background-color,border-color] duration-[160ms] ease-out focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97] aria-checked:border-primary aria-checked:bg-primary/5 [@media(hover:hover)]:hover:border-foreground/40 motion-reduce:transition-none motion-reduce:active:scale-100'

/** What the choices add up to, in pages: a cover, then each entry with its sources page. */
export function pageSummary(entries: GenerationOptions['entries']) {
  if (entries === 'auto')
    return 'A cover, then each entry with its sources page: 2 to 4 entries for most sources.'
  const pages = 1 + entries * 2
  return `A cover and ${entries} ${entries === 1 ? 'entry' : 'entries'} with ${entries === 1 ? 'its sources page' : 'their sources pages'}: about ${pages} pages.`
}

/**
 * The choices that shape a generated portfolio: Entries, Depth, Include images and the live
 * page-count summary. Shared by the canvas "Generate pages" dialog and the New case study form.
 * `imageCount` is the number of uploaded images of the document, or null when there is no
 * document yet.
 */
export function PortfolioOptions({
  value,
  onChange,
  imageCount,
  disabled = false,
  idPrefix = 'portfolio',
}: {
  value: Pick<GenerationOptions, 'entries' | 'depth' | 'images'>
  onChange: (next: Partial<Pick<GenerationOptions, 'entries' | 'depth' | 'images'>>) => void
  imageCount: number | null
  disabled?: boolean
  idPrefix?: string
}) {
  return (
    <>
      <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
        <legend className="mb-1 text-sm font-medium">Entries</legend>
        <div role="radiogroup" aria-label="Entries" className="flex flex-wrap gap-1.5">
          {ENTRY_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value.entries === n}
              className={`${radio} min-w-14 flex-none items-center px-3 py-1.5`}
              onClick={() => onChange({ entries: n })}
            >
              <span className="font-medium">{n === 'auto' ? 'Auto' : n}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {pageSummary(value.entries)}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
        <legend className="mb-1 text-sm font-medium">Depth</legend>
        <div role="radiogroup" aria-label="Depth" className="flex gap-2">
          {DEPTHS.map((d) => (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={value.depth === d.value}
              className={radio}
              onClick={() => onChange({ depth: d.value })}
            >
              <span className="font-medium">{d.label}</span>
              <span className="text-xs text-muted-foreground">{d.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Switch
            id={`${idPrefix}-images`}
            checked={value.images}
            disabled={disabled}
            onCheckedChange={(images) => onChange({ images })}
          />
          <label htmlFor={`${idPrefix}-images`} className="text-sm font-medium">
            Include images
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {imageCount === null
            ? 'Uses pictures from your sources that are large enough to print sharp, up to four beside each entry.'
            : imageCount === 0
              ? 'This document has no uploaded images. Pictures from your sources are used when they are large enough to print sharp.'
              : `Uses your ${imageCount} uploaded image${imageCount === 1 ? '' : 's'} and pictures from your sources that are large enough to print sharp, up to four beside each entry.`}
        </p>
      </div>
    </>
  )
}
