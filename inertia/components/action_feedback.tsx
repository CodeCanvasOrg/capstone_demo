import { AlertCircle, LogIn, RotateCcw } from 'lucide-react'
import { Link } from '@adonisjs/inertia/react'
import type { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'

export function ActionFeedback({
  error,
  onRetry,
  busy = false,
}: {
  error?: ApiError | null
  onRetry?: () => void
  busy?: boolean
}) {
  if (!error) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0 space-y-2">
        <p className="break-words text-destructive">{error.message}</p>
        {error.status === 401 || error.status === 419 ? (
          <Button asChild size="sm" variant="outline">
            <Link route="session.create" target="_blank" rel="noreferrer">
              <LogIn aria-hidden="true" />
              Sign in<span className="sr-only"> in a new tab</span>
            </Link>
          </Button>
        ) : onRetry && error.retryable ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRetry}>
            <RotateCcw aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  ) : null
}

export function focusInvalid(form: HTMLFormElement) {
  requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
}
