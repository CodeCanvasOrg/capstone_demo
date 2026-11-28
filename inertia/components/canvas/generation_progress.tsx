import { AlertTriangle, Check, LoaderCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { isActive, pageLabel, STEPS, stepIndex, stepLabel, type Run } from './generation'

/**
 * The run's progress: a stepper (planning, gathering evidence, writing page 3 of 8,
 * fitting, placing images, laying out) and a chip for each page as it is written. It
 * ends in a toast: the pages are ready (reload shows them) or the run failed and the
 * previous version is untouched.
 */
export function GenerationProgress({
  run,
  announce,
  onRetry,
  onShow,
}: {
  run: Run | null
  /** A toast is shown for the run requested in this visit, not for one found at load. */
  announce: boolean
  onRetry: () => void
  onShow: () => void
}) {
  const told = useRef<string | null>(null)
  useEffect(() => {
    if (!run || !announce || told.current === `${run.id}:${run.status}`) return
    if (run.status === 'ready') {
      told.current = `${run.id}:ready`
      toast.success('Pages generated', {
        description: 'Reload the canvas to see them.',
        action: { label: 'Show pages', onClick: onShow },
      })
    }
    if (run.status === 'failed') {
      told.current = `${run.id}:failed`
      toast.error('Pages could not be generated', {
        description: run.error ?? 'Your previous version is unchanged.',
      })
    }
  }, [run, announce, onShow])

  if (!run || (!isActive(run) && !(announce && ['ready', 'failed'].includes(run.status))))
    return null
  const current = stepIndex(run)
  const done = run.status === 'ready'
  const failed = run.status === 'failed'
  const percent = done ? 100 : Math.max(5, Math.round(((current + 0.5) / STEPS.length) * 100))
  return (
    <section
      aria-label="Page generation"
      data-testid="generation-progress"
      data-status={run.status}
      className="flex flex-col gap-2 border-b bg-muted/40 px-4 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {STEPS.map((step, i) => {
            const state = done || i < current ? 'done' : i === current && !failed ? 'now' : 'next'
            return (
              <li
                key={step.key}
                aria-current={state === 'now' ? 'step' : undefined}
                className={`flex items-center gap-1 ${
                  state === 'now'
                    ? 'font-semibold text-foreground'
                    : state === 'done'
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60'
                }`}
              >
                {state === 'done' ? (
                  <Check aria-hidden="true" className="size-3.5 text-emerald-600" />
                ) : state === 'now' ? (
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <span aria-hidden="true" className="size-3.5 text-center">
                    ·
                  </span>
                )}
                {stepLabel(run, step.key)}
              </li>
            )
          })}
        </ol>
        <div className="ml-auto flex items-center gap-2">
          {failed && (
            <>
              <span className="flex items-center gap-1 text-xs text-destructive" role="status">
                <AlertTriangle aria-hidden="true" className="size-3.5" />
                {run.error ?? 'Generation failed. Your previous version is unchanged.'}
              </span>
              <Button size="xs" variant="outline" onClick={onRetry}>
                Try again
              </Button>
            </>
          )}
          {done && (
            <Button size="xs" onClick={onShow}>
              Show pages
            </Button>
          )}
        </div>
      </div>
      {!failed && <Progress value={percent} aria-label="Generation progress" className="h-1" />}
      {run.pages.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Pages">
          {run.pages.map((page) => (
            <li
              key={page.index}
              data-status={page.status}
              className={`rounded-full border px-2 py-0.5 text-[10px] ${
                page.status === 'pending'
                  ? 'text-muted-foreground'
                  : page.status === 'failed'
                    ? 'border-destructive text-destructive'
                    : 'border-emerald-600/40 text-foreground'
              }`}
            >
              {page.index + 1}. {pageLabel(run.pages, page.index)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
