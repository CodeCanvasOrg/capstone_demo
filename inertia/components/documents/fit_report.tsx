import { AlertCircle, CheckCircle2, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type FitFinding = {
  code: string
  severity: 'error' | 'warning'
  message: string
  field?: string
}
export type FitStep =
  { kind: 'compact_variant'; applied: boolean } | { kind: 'suggest_template'; templateId: string }
export type LayoutReport = {
  pages: number
  pageBudget: number
  fits: boolean
  density: 'normal' | 'compact'
  steps: FitStep[]
  findings: FitFinding[]
}

/**
 * Page-budget feedback beside the layout choice. Errors block final export and
 * cannot be waved through by approval; warnings are informational. Nothing here
 * edits content: a suggested template is offered, never applied silently.
 */
export function FitReport({
  report,
  titleFor,
  onSwitch,
  disabled,
}: {
  report: LayoutReport | null
  titleFor: (templateId: string) => string
  onSwitch: (templateId: string) => void
  disabled?: boolean
}) {
  if (!report)
    return (
      <p className="text-xs text-muted-foreground">
        Save a version to see how it fits this layout.
      </p>
    )
  const errors = report.findings.filter((finding) => finding.severity === 'error')
  const warnings = report.findings.filter((finding) => finding.severity === 'warning')
  const suggestion = report.steps.find(
    (step): step is Extract<FitStep, { kind: 'suggest_template' }> =>
      step.kind === 'suggest_template'
  )
  return (
    <section aria-label="Page fit" className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        {report.fits ? (
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />
        )}
        <span className="font-semibold">
          {report.fits ? 'Fits' : 'Does not fit'}: about {report.pages}{' '}
          {report.pages === 1 ? 'page' : 'pages'} of {report.pageBudget}
        </span>
        {report.density === 'compact' && <Badge variant="secondary">Compact type</Badge>}
      </div>
      {suggestion && (
        <div className="space-y-2 rounded-lg border p-3 text-xs">
          <p>
            Switch to <strong>{titleFor(suggestion.templateId)}</strong> to keep all of the content.
            Your text is not changed.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onSwitch(suggestion.templateId)}
          >
            Use {titleFor(suggestion.templateId)}
          </Button>
        </div>
      )}
      {errors.length > 0 && (
        <div role="alert" className="space-y-1">
          <h3 className="flex items-center gap-1 text-xs font-semibold text-destructive">
            <AlertCircle aria-hidden="true" className="size-3.5" />
            Fix before final export
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            {errors.map((finding, index) => (
              <li key={`${finding.code}-${index}`}>{finding.message}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="space-y-1">
          <h3 className="flex items-center gap-1 text-xs font-semibold">
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            For your review
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {warnings.map((finding, index) => (
              <li key={`${finding.code}-${index}`}>{finding.message}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
