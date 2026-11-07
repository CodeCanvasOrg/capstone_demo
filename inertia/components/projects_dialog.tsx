import { useState, type FormEvent } from 'react'
import { useForm } from '@inertiajs/react'
import type { Data } from '@generated/data'
import { FolderOpen, Plus, Save } from 'lucide-react'
import { urlFor } from '@/client'
import { useUnsavedChanges, useWorkspace, useWorkspaceId } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { RichTextEditor, textToRichText, type RichText } from '@/components/rich_text_editor'
export function ProjectDialog({ project }: { project?: Data.Project }) {
  const workspaceId = useWorkspaceId()
  const { workspace } = useWorkspace()
  const [open, setOpen] = useState(false)
  const form = useForm({
    name: project?.name ?? '',
    description: project?.description ?? '',
    descriptionContent: (project?.descriptionContent ??
      textToRichText(project?.description ?? '')) as RichText,
  })
  useUnsavedChanges('project-dialog', open && form.isDirty)
  function changeOpen(next: boolean) {
    if (!next && form.isDirty && !window.confirm('Discard this project draft?')) return
    if (next) {
      const values = {
        name: project?.name ?? '',
        description: project?.description ?? '',
        descriptionContent:
          project?.descriptionContent ?? textToRichText(project?.description ?? ''),
      }
      form.setDefaults(values)
      form.setData(values)
      form.clearErrors()
    }
    setOpen(next)
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    const options = {
      preserveScroll: true,
      onSuccess: () => {
        form.setDefaults()
        setOpen(false)
      },
    }
    if (project)
      form.patch(urlFor('projects.update', { workspaceId, projectId: project.id }), options)
    else form.post(urlFor('projects.store', { workspaceId }), options)
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant={project ? 'ghost' : 'default'} size="sm">
          {!project && <Plus className="size-3.5" />}
          {project ? 'Edit project' : 'New project'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="px-6 pt-6 text-left">
          <DialogTitle className="text-xs font-medium text-muted-foreground">
            {workspace?.name} <span className="mx-1">/</span>{' '}
            {project ? 'Edit project' : 'New project'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Name the project and write a brief. You can add sources once it is created.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="px-6 pt-6">
            <FolderOpen className="mb-4 size-6 text-muted-foreground" />
            <label htmlFor="project-dialog-name" className="sr-only">
              Project name
            </label>
            <input
              id="project-dialog-name"
              value={form.data.name}
              onChange={(event) => form.setData('name', event.target.value)}
              placeholder="Project name"
              required
              maxLength={120}
              disabled={form.processing}
              aria-invalid={!!form.errors.name}
              aria-describedby={form.errors.name ? 'project-dialog-name-error' : undefined}
              className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 focus-visible:rounded-sm"
            />
            {form.errors.name && (
              <p
                id="project-dialog-name-error"
                role="alert"
                className="mt-2 text-xs text-destructive"
              >
                {form.errors.name}
              </p>
            )}
          </div>
          <div className="mx-6 mt-6 border-t py-5">
            <RichTextEditor
              value={form.data.descriptionContent}
              onChange={(value, text) =>
                form.setData({ ...form.data, description: text, descriptionContent: value })
              }
              error={form.errors.description || form.errors.descriptionContent}
              label="Project description"
              placeholder="Project brief…"
              disabled={form.processing}
            />
          </div>
          <div className="flex justify-end gap-2 rounded-b-2xl border-t bg-muted/20 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => changeOpen(false)}
              disabled={form.processing}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={form.processing || !form.data.name.trim()}>
              {project ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {form.processing
                ? project
                  ? 'Saving…'
                  : 'Creating…'
                : project
                  ? 'Save'
                  : 'Create project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
