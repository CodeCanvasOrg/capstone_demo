import { AlertTriangle, CircleAlert } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { quality, type RunPage } from './generation'

const TONE = {
  ok: { bar: 'bg-emerald-500', text: 'text-muted-foreground' },
  warn: { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  bad: { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
} as const

/**
 * How a generated page is doing, small enough for the page strip: words, a fill bar,
 * citations. Amber when it is thin, under-cited or its picture would print soft; red
 * when it has placeholders. The tooltip lists why, and the reviewer notes.
 */
export function PageQualityBadge({ page }: { page: RunPage }) {
  const q = quality(page)
  if (!q) return null
  const tone = TONE[q.level]
  const fill = Math.min(page.fill ?? 0, 1)
  const label = [
    `${page.words ?? 0} words`,
    page.fill !== null ? `${Math.round(page.fill * 100)}% full` : null,
    `${page.citations} citation${page.citations === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex w-full flex-col gap-0.5 text-left"
          data-testid="page-quality"
          data-level={q.level}
          tabIndex={0}
          aria-label={`Page quality: ${label}${q.reasons.length ? `. ${q.reasons.join('. ')}` : ''}`}
        >
          <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className={`h-full ${tone.bar}`} style={{ width: `${Math.round(fill * 100)}%` }} />
          </div>
          <span className={`flex items-center gap-1 text-[10px] tabular-nums ${tone.text}`}>
            {q.level === 'bad' ? (
              <CircleAlert aria-hidden="true" className="size-3" />
            ) : q.level === 'warn' ? (
              <AlertTriangle aria-hidden="true" className="size-3" />
            ) : null}
            {page.words ?? 0}w · {page.fill !== null ? `${Math.round(page.fill * 100)}%` : '-'} ·{' '}
            {page.citations} cited
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        <p className="font-medium">{label}</p>
        {q.reasons.map((r) => (
          <p key={r}>{r}</p>
        ))}
        {page.notes.length > 0 && (
          <ul className="mt-1 list-disc pl-4">
            {page.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
