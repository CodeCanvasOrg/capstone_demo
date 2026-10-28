import { Button } from '@/components/ui/button'
import type { OutlineTemplate } from '../../../shared/templates/outlines'

export function OutlinePicker({
  templates,
  onUse,
  disabled,
  canCreate,
}: {
  templates: OutlineTemplate[]
  onUse: (id: string) => void
  disabled: boolean
  canCreate: boolean
}) {
  return (
    <section className="mt-8" aria-labelledby="outline-heading" aria-busy={disabled}>
      <h2 id="outline-heading" className="text-base font-semibold">
        Start with a template
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Or choose a template to shape your case study.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {templates.map((template) => (
          <Button
            key={template.id}
            type="button"
            variant="outline"
            disabled={disabled || !canCreate}
            onClick={() => onUse(template.id)}
          >
            {template.definition.name}
          </Button>
        ))}
      </div>
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        {!templates.length
          ? 'Company templates are unavailable. Reload this page to try again.'
          : disabled
            ? 'Creating your case study…'
            : !canCreate
              ? 'Add a brief above to get started.'
              : null}
      </p>
    </section>
  )
}
