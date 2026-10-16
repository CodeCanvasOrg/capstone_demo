import { useState } from 'react'
import { useForm } from '@inertiajs/react'
import type { Data } from '@generated/data'
import { ArrowUp, FolderOpen, MessageSquare, Sparkles, LoaderCircle } from 'lucide-react'
import { urlFor } from '@/client'
import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { SourcePicker } from '@/components/files/source_picker'
import {
  RichTextEditor,
  emptyRichText,
  textToRichText,
  type RichText,
} from '@/components/rich_text_editor'

export function DocumentForm({
  files = [],
  projects = [],
  initialProjectId = null,
}: {
  files?: Data.File[]
  projects?: Data.Project[]
  initialProjectId?: string | null
}) {
  const workspaceId = useWorkspaceId()
  const [composer, setComposer] = useState<RichText>(emptyRichText)
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const form = useForm({
    title: '',
    description: '',
    descriptionContent: emptyRichText(),
    projectId: null as string | null,
    sourceMode: 'input_only' as 'files' | 'input_only',
    projectInformation: { overview: '' },
    files: [] as { id: string }[],
  })
  useUnsavedChanges('new-case-study', !form.processing && (!!text.trim() || selected.length > 0))
  function create() {
    if (form.processing || !text.trim() || text.length > 20000) return
    form.transform(() => ({
      title: text.trim().split('\n')[0].slice(0, 100),
      description: text,
      descriptionContent: composer,
      projectId: projectId || null,
      sourceMode: selected.length ? 'files' : 'input_only',
      projectInformation: { overview: text },
      files: selected.map((id) => ({ id })),
    }))
    form.post(urlFor('documents.store', { workspaceId }))
  }
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-16">
      <div className="mb-8">
        <div className="mb-5 flex size-9 items-center justify-center rounded-xl border text-muted-foreground">
          <MessageSquare className="size-4" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          What story are we telling?
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Describe your project and add any sources. Your document opens as soon as you send the
          brief.
        </p>
      </div>
      <div className="rounded-2xl border bg-sidebar p-4 shadow-xs">
        <RichTextEditor
          value={composer}
          onSubmit={create}
          onChange={(value, plain) => {
            setComposer(value)
            setText(plain)
          }}
          label="Case-study brief"
          placeholder="Tell us about the work, the challenge, and what changed…"
          compact
          disabled={form.processing}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <SourcePicker
              files={files}
              selected={selected}
              onChange={setSelected}
              disabled={form.processing}
            />
            <label className="inline-flex max-w-48 items-center gap-1 text-xs text-muted-foreground">
              <FolderOpen className="size-3.5 shrink-0" />
              <span className="sr-only">Project</span>
              <select
                aria-label="Project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={form.processing}
                className="min-w-0 max-w-40 bg-transparent py-1.5 outline-none"
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button
            type="button"
            size="icon-sm"
            aria-label="Create and generate case study"
            onClick={create}
            disabled={form.processing || !text.trim() || text.length > 20000}
          >
            {form.processing ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {selected.length
          ? `${selected.length} sources attached · Your draft will use these files once preparation finishes.`
          : 'Writing from your brief only · Attach files to include source evidence.'}
      </p>
      {text.length > 20000 && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          Keep the brief under 20,000 characters.
        </p>
      )}
      {Object.entries(form.errors).map(([key, error]) => (
        <p role="alert" key={key} className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ))}
      <div className="mt-8 grid gap-2 sm:grid-cols-3">
        {['A project we delivered', 'A problem we solved', 'Results worth sharing'].map(
          (example, index) => (
            <button
              key={example}
              type="button"
              disabled={form.processing}
              className="rounded-lg border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-muted/40"
              onClick={() => {
                const value = [
                  'We built ',
                  'We helped our team solve ',
                  'Our project made a difference by ',
                ][index]
                setText(value)
                setComposer(textToRichText(value))
              }}
            >
              <Sparkles className="mb-3 size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{example}</span>
            </button>
          )
        )}
      </div>
    </div>
  )
}
