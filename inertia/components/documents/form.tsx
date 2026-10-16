import { useState, type FormEvent } from 'react'
import { useForm } from '@inertiajs/react'
import type { Data } from '@generated/data'
import { urlFor } from '@/client'
import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ProjectFields, TitleField, type ProjectInformation } from './project_fields'
import { ProcessingStatusBadge } from './status'
export function DocumentForm({
  files = [],
  projects = [],
}: {
  files?: Data.File[]
  projects?: Data.Project[]
}) {
  const workspaceId = useWorkspaceId()
  const [selected, setSelected] = useState<string[]>([])
  const form = useForm({
    title: '',
    description: '',
    projectId: '',
    dueDate: '',
    projectInformation: {} as ProjectInformation,
    sourceMode: 'files' as 'files' | 'input_only',
    files: [] as { id: string }[],
  })
  useUnsavedChanges('new-case-study', form.isDirty || selected.length > 0)
  function submit(event: FormEvent) {
    event.preventDefault()
    form.transform((data) => ({
      ...data,
      projectId: data.projectId || null,
      dueDate: data.dueDate || null,
      files: data.sourceMode === 'files' ? selected.map((id) => ({ id })) : [],
    }))
    form.post(urlFor('documents.store', { workspaceId }))
  }
  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-5">
        <TitleField value={form.data.title} onChange={(value) => form.setData('title', value)} />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="project">Project (optional)</Label>
            <select
              id="project"
              className="form-select"
              value={form.data.projectId}
              onChange={(event) => form.setData('projectId', event.target.value)}
            >
              <option value="">Ungrouped</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline (optional)</Label>
            <Input
              id="deadline"
              type="date"
              value={form.data.dueDate}
              onChange={(event) => form.setData('dueDate', event.target.value)}
            />
          </div>
        </div>
      </section>
      <section className="space-y-5 border-t pt-6">
        <div>
          <h2 className="text-lg font-semibold">Project information</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Save a draft at any point. Complete these seven fields before submitting for review.
          </p>
        </div>
        <ProjectFields
          value={form.data.projectInformation}
          onChange={(value) => form.setData('projectInformation', value)}
        />
      </section>
      <section className="space-y-4 border-t pt-6">
        <h2 className="text-lg font-semibold">Source material</h2>
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Writing sources</legend>
          {(['files', 'input_only'] as const).map((mode) => (
            <label
              key={mode}
              className="flex items-start gap-3 rounded-lg border bg-sidebar p-4 text-sm"
            >
              <input
                type="radio"
                name="sourceMode"
                value={mode}
                checked={form.data.sourceMode === mode}
                onChange={() => form.setData('sourceMode', mode)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">
                  {mode === 'files' ? 'Use shared files' : 'Write from project information only'}
                </span>
                <span className="mt-1 block text-muted-foreground">
                  {mode === 'files'
                    ? 'Select evidence from this workspace.'
                    : 'No file evidence. The owner must acknowledge this limitation before approval.'}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {form.data.sourceMode === 'files' && (
          <div className="max-h-80 overflow-auto rounded-lg border bg-sidebar">
            {files.map((file) => (
              <label
                key={file.id}
                className="flex cursor-pointer items-center gap-3 border-b p-4 last:border-0"
              >
                <Checkbox
                  checked={selected.includes(file.id)}
                  onCheckedChange={(checked) =>
                    setSelected((value) =>
                      checked ? [...value, file.id] : value.filter((id) => id !== file.id)
                    )
                  }
                />
                <span className="min-w-0 flex-1 truncate text-sm">{file.filename}</span>
                <ProcessingStatusBadge status={file.processingStatus} />
              </label>
            ))}
            {!files.length && (
              <p className="p-5 text-sm text-muted-foreground">
                No files in this workspace. Upload files from the library, or choose input-only
                writing.
              </p>
            )}
          </div>
        )}
      </section>
      {Object.values(form.errors).length > 0 && (
        <div
          role="alert"
          className="space-y-1 rounded-lg border border-destructive p-4 text-sm text-destructive"
        >
          {Object.entries(form.errors).map(([key, message]) => (
            <p key={key}>{message}</p>
          ))}
        </div>
      )}
      <div className="flex items-center gap-4 border-t pt-6">
        <Button disabled={form.processing}>{form.processing ? 'Creating…' : 'Create draft'}</Button>
        <p className="text-xs text-muted-foreground">
          Generate an AI draft from the editor when you are ready.
        </p>
      </div>
    </form>
  )
}
