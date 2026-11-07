import { useState } from 'react'
import { useForm } from '@inertiajs/react'
import type { Data } from '@generated/data'
import { ArrowUp, FolderOpen, MessageSquare } from 'lucide-react'
import { urlFor } from '@/client'
import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { OutlinePicker } from '@/components/documents/outline_picker'
import type { OutlineTemplate } from '../../../shared/templates/outlines'
import { Disclosure } from '@/components/disclosure'
import { Button } from '@/components/ui/button'
import { SourcePicker, selectable, type SourceChoice } from '@/components/files/source_picker'
import { RichTextEditor, emptyRichText, type RichText } from '@/components/rich_text_editor'

export function DocumentForm({
  templates = [],
  files = [],
  projects = [],
  initialProjectId = null,
}: {
  templates?: OutlineTemplate[]
  files?: Data.File[]
  projects?: Data.Project[]
  initialProjectId?: string | null
}) {
  const workspaceId = useWorkspaceId()
  const [composer, setComposer] = useState<RichText>(emptyRichText)
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const [uploads, setUploads] = useState<SourceChoice[]>([])
  const [droppedSources, setDroppedSources] = useState(0)
  function changeProject(next: string) {
    const choices = new Map([...files, ...uploads].map((file) => [file.id, file]))
    const kept = selected.filter((id) => {
      const file = choices.get(id)
      return !file || selectable(file, next || null)
    })
    setDroppedSources(selected.length - kept.length)
    setSelected(kept)
    setProjectId(next)
  }
  const form = useForm({
    templateId: null as string | null,
    description: '',
    descriptionContent: emptyRichText(),
    projectId: null as string | null,
    sourceMode: 'input_only' as 'files' | 'input_only',
    projectInformation: { overview: '' },
    files: [] as { id: string }[],
  })
  useUnsavedChanges('new-case-study', !form.processing && (!!text.trim() || selected.length > 0))
  // A null template writes a freeform case study from the brief alone.
  function create(templateId: string | null) {
    if (form.processing || !text.trim() || text.length > 20000) return
    form.transform(() => ({
      templateId,
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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">New case study</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          What did you work on?
        </p>
      </div>
      <div className="rounded-2xl border bg-sidebar p-4 shadow-xs">
        <RichTextEditor
          value={composer}
          onChange={(value, plain) => {
            setComposer(value)
            setText(plain)
          }}
          error={
            form.errors.description ||
            form.errors.descriptionContent ||
            form.errors.projectInformation
          }
          label="Case-study brief"
          placeholder="The work, the challenge, the results…"
          compact
          disabled={form.processing}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <SourcePicker
              files={files}
              selected={selected}
              onChange={setSelected}
              onUploaded={(file) => setUploads((current) => [...current, file])}
              projectId={projectId || null}
              disabled={form.processing}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={form.processing || !text.trim() || text.length > 20000}
            onClick={() => create(null)}
          >
            <ArrowUp aria-hidden="true" />
            Send
          </Button>
        </div>
      </div>
      {projects.length > 0 && (
        <Disclosure
          title="Project"
          icon={FolderOpen}
          summary={projects.find((project) => project.id === projectId)?.name ?? 'Optional'}
          reveal={!!form.errors.projectId}
        >
          <label className="inline-flex max-w-48 items-center gap-1 text-xs text-muted-foreground">
            <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">Project</span>
            <select
              aria-label="Project"
              aria-invalid={!!form.errors.projectId}
              aria-describedby={form.errors.projectId ? 'brief-project-error' : undefined}
              value={projectId}
              onChange={(event) => changeProject(event.target.value)}
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
          {form.errors.projectId && (
            <p id="brief-project-error" role="alert" className="text-xs text-destructive">
              {form.errors.projectId}
            </p>
          )}
          {droppedSources > 0 && (
            <p role="status" className="text-xs text-muted-foreground">
              {droppedSources === 1
                ? '1 source from the previous project was removed.'
                : `${droppedSources} sources from the previous project were removed.`}
            </p>
          )}
        </Disclosure>
      )}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {selected.length
          ? `${selected.length} sources · Prepare files before generation.`
          : 'Brief only · No sources attached.'}
      </p>
      {text.length > 20000 && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          Keep the brief under 20,000 characters.
        </p>
      )}
      {Object.entries(form.errors)
        .filter(
          ([key]) =>
            !['description', 'descriptionContent', 'projectInformation', 'projectId'].includes(key)
        )
        .map(([key, error]) => (
          <p role="alert" key={key} className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ))}
      <OutlinePicker
        templates={templates}
        onUse={create}
        disabled={form.processing}
        canCreate={!!text.trim() && text.length <= 20000}
      />
    </div>
  )
}
