import { useCallback, useEffect, useState } from 'react'
import { router } from '@inertiajs/react'
import { LayoutTemplate, LoaderCircle } from 'lucide-react'
import { urlFor } from '@/client'
import { api, feedbackError, type ApiError } from '@/lib/api'
import { useUnsavedChanges, useWorkspaceId } from '@/providers/workspace_provider'
import { ActionFeedback } from '@/components/action_feedback'
import { Disclosure } from '@/components/disclosure'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FitReport, type LayoutReport } from './fit_report'

type Template = {
  id: string
  version: number
  title: string
  description: string
  pageBudget: number
}
type Preset = { id: string; name: string; templateId: string }
type Options = { imageMode: 'auto' | 'with' | 'without'; cta?: { label: string; href: string } }
type Selection = {
  templateId: string
  templateVersion: number
  brandVersion: number
  options: Options
  presetId: string | null
  revision: number
  saved: boolean
}
type Payload = {
  selection: Selection
  catalog: {
    templates: Template[]
    brands: { id: string; name: string; version: number }[]
    presets: Preset[]
  }
  report: LayoutReport | null
}

const IMAGE_MODES = [
  ['auto', 'Use images when the case study has them'],
  ['with', 'Always show images'],
  ['without', 'No images'],
] as const

/**
 * Template, brand and option choices for one document. The server validates
 * every id and option; this form only offers what the catalog returned. Saving
 * a different layout withdraws review and approval, so the form says so first.
 */
export function LayoutPicker({ documentId, disabled }: { documentId: string; disabled: boolean }) {
  const workspaceId = useWorkspaceId()
  const url = urlFor('documentLayouts.show', { workspaceId, documentId })
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [imageMode, setImageMode] = useState<Options['imageMode']>('auto')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaHref, setCtaHref] = useState('')

  const adopt = useCallback((next: Payload) => {
    setData(next)
    setTemplateId(next.selection.templateId)
    setImageMode(next.selection.options.imageMode)
    setCtaLabel(next.selection.options.cta?.label ?? '')
    setCtaHref(next.selection.options.cta?.href ?? '')
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    api<{ data: Payload }>(url, 'GET', undefined, controller.signal)
      .then((body) => adopt(body.data))
      .catch((reason) => {
        if (!(reason instanceof DOMException)) setError(feedbackError(reason))
      })
    return () => controller.abort()
  }, [url, adopt])

  const selection = data?.selection
  const cta =
    ctaLabel.trim() || ctaHref.trim() ? { label: ctaLabel.trim(), href: ctaHref.trim() } : undefined
  const dirty =
    !!selection &&
    (templateId !== selection.templateId ||
      imageMode !== selection.options.imageMode ||
      (cta?.label ?? '') !== (selection.options.cta?.label ?? '') ||
      (cta?.href ?? '') !== (selection.options.cta?.href ?? ''))
  useUnsavedChanges('layout-selection', dirty)

  async function save(overrideTemplate?: string) {
    if (!selection) return
    setBusy(true)
    setError(null)
    try {
      const body = await api<{ data: Pick<Payload, 'selection' | 'report'> }>(
        urlFor('documentLayouts.update', { workspaceId, documentId }),
        'PUT',
        {
          templateId: overrideTemplate ?? templateId,
          options: { imageMode, ...(cta ? { cta } : {}) },
          baseRevision: selection.revision,
        }
      )
      adopt({ ...data!, ...body.data })
      // Review and approval may have been withdrawn by a layout change.
      router.reload({ only: ['document', 'workflow'] })
      window.dispatchEvent(new Event('layout-changed'))
    } catch (reason) {
      setError(feedbackError(reason))
    } finally {
      setBusy(false)
    }
  }

  async function applyPreset(presetId: string) {
    if (!selection || !presetId) return
    setBusy(true)
    setError(null)
    try {
      await api(urlFor('documentLayouts.applyPreset', { workspaceId, documentId }), 'POST', {
        presetId,
        baseRevision: selection.revision,
      })
      const body = await api<{ data: Payload }>(url)
      adopt(body.data)
      router.reload({ only: ['document', 'workflow'] })
      window.dispatchEvent(new Event('layout-changed'))
    } catch (reason) {
      setError(feedbackError(reason))
    } finally {
      setBusy(false)
    }
  }

  const templates = data?.catalog.templates ?? []
  const current = templates.find((template) => template.id === templateId)
  const brand = data?.catalog.brands.find((item) => item.version === selection?.brandVersion)
  return (
    <Disclosure
      title="Layout and branding"
      icon={LayoutTemplate}
      summary={
        current ? `${current.pageBudget} ${current.pageBudget === 1 ? 'page' : 'pages'}` : undefined
      }
      reveal={dirty || !!error}
    >
      <ActionFeedback error={error} busy={busy} />
      {!data && !error && (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Loading layouts…
        </p>
      )}
      {data && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <fieldset className="space-y-2" disabled={disabled || busy}>
            <legend className="eyebrow">Template</legend>
            {templates.map((template) => (
              <label
                key={template.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-xs has-[:checked]:border-primary has-[:focus-visible]:ring-2"
              >
                <input
                  type="radio"
                  name="template"
                  value={template.id}
                  checked={templateId === template.id}
                  onChange={() => setTemplateId(template.id)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block font-semibold">{template.title}</span>
                  <span className="block text-muted-foreground">{template.description}</span>
                  <span className="mt-1 block">
                    Up to {template.pageBudget} {template.pageBudget === 1 ? 'page' : 'pages'},
                    sources included
                  </span>
                </span>
              </label>
            ))}
            {!templates.length && (
              <p className="text-xs text-muted-foreground">
                No layout is available for this content type yet.
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-2" disabled={disabled || busy}>
            <legend className="eyebrow">Images</legend>
            {IMAGE_MODES.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="imageMode"
                  value={value}
                  checked={imageMode === value}
                  onChange={() => setImageMode(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2" disabled={disabled || busy}>
            <legend className="eyebrow">Call to action (optional)</legend>
            <div className="space-y-1">
              <Label htmlFor={`cta-label-${documentId}`}>Button text</Label>
              <Input
                id={`cta-label-${documentId}`}
                value={ctaLabel}
                maxLength={80}
                onChange={(event) => setCtaLabel(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`cta-href-${documentId}`}>Link</Label>
              <Input
                id={`cta-href-${documentId}`}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={ctaHref}
                onChange={(event) => setCtaHref(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Nothing is shown unless you add both. It is never written for you.
            </p>
          </fieldset>

          {brand && (
            <p className="text-xs text-muted-foreground">
              Brand: {brand.name}, version {brand.version}. New brand versions never change a
              document until you choose them.
            </p>
          )}

          {data.catalog.presets.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor={`preset-${documentId}`}>Saved preset</Label>
              <select
                id={`preset-${documentId}`}
                className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                disabled={disabled || busy || dirty}
                value=""
                onChange={(event) => void applyPreset(event.target.value)}
              >
                <option value="">Apply a preset…</option>
                {data.catalog.presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {dirty && (
            <p className="text-xs text-muted-foreground">
              Changing the layout withdraws any review or approval of this version.
            </p>
          )}
          <Button type="submit" size="sm" disabled={disabled || busy || !dirty || !templateId}>
            {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
            Save layout
          </Button>

          <FitReport
            report={data.report}
            disabled={disabled || busy}
            titleFor={(id) => templates.find((template) => template.id === id)?.title ?? id}
            onSwitch={(id) => {
              setTemplateId(id)
              void save(id)
            }}
          />
        </form>
      )}
    </Disclosure>
  )
}
