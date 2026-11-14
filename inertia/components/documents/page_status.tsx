import { AlertCircle, CheckCircle2, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type PageStats = {
  pages: number
  budget?: number
  lastFill: number
  excess: number
  lineHeight: number
}
export type LayoutChoice = { id: string; title: string; pageBudget: number }

/** Words for the shorten-to-fit request; it protects results, evidence labels and citations. */
export const shortenRequest = (budget: number, lines: number) =>
  `Shorten this case study to fit ${budget} ${budget === 1 ? 'page' : 'pages'}; it is about ${lines} lines over. Keep every result with its evidence label and qualifier, and keep every citation. Cut the least important detail first and do not add new facts.`

/**
 * Live page budget for the editor: how many pages the content runs to, how full
 * the last one is, how much to cut when it is over, and a switch to another
 * layout. Over budget is stated plainly and never hidden; the offered actions
 * change nothing until the person confirms them.
 */
export function PageStatus({
  stats,
  layouts,
  selected,
  disabled,
  onSwitch,
  onShorten,
}: {
  stats: PageStats | null
  layouts: LayoutChoice[]
  selected: string
  disabled: boolean
  onSwitch: (id: string) => void
  onShorten: (lines: number) => void
}) {
  if (!stats) return null
  const over = stats.budget !== undefined && stats.pages > stats.budget
  const lines = Math.max(1, Math.round(stats.excess / (stats.lineHeight || 20)))
  const current = layouts.find((layout) => layout.id === selected)
  const larger = layouts.find((layout) => layout.pageBudget > (stats.budget ?? 0))
  return (
    <div className="page-status mb-3 space-y-2" data-state={over ? 'over' : 'ok'}>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background px-3 py-2 text-xs">
        {over ? (
          <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
        )}
        <span role="status" className={over ? 'font-semibold text-destructive' : 'font-semibold'}>
          {over
            ? `${stats.pages} pages: over the ${stats.budget}-page limit`
            : stats.budget !== undefined
              ? `${stats.pages} of ${stats.budget} ${stats.budget === 1 ? 'page' : 'pages'} used`
              : `${stats.pages} ${stats.pages === 1 ? 'page' : 'pages'}`}
        </span>
        {!over && (
          <span className="text-muted-foreground">
            Last page {Math.min(100, Math.round(stats.lastFill * 100))}% full
          </span>
        )}
        {layouts.length > 1 && (
          <label className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground">Layout</span>
            <select
              className="h-7 rounded-md border bg-background px-2 text-xs"
              value={selected}
              disabled={disabled}
              onChange={(event) => onSwitch(event.target.value)}
            >
              {layouts.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.title} ({layout.pageBudget} {layout.pageBudget === 1 ? 'page' : 'pages'})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {over && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs"
        >
          <span className="min-w-0 flex-1">
            About {lines} {lines === 1 ? 'line' : 'lines'} too long for{' '}
            {current?.title ?? 'this layout'}. Final export is blocked until it fits. Nothing is cut
            automatically.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onShorten(lines)}
          >
            <Scissors aria-hidden="true" />
            Shorten to fit
          </Button>
          {larger && larger.id !== selected && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onSwitch(larger.id)}
            >
              Use {larger.title}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
