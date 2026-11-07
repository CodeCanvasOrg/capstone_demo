import { useEffect, useState } from 'react'
import { router } from '@inertiajs/react'
import { Form, Link } from '@adonisjs/inertia/react'
import type { Data } from '@generated/data'
import { FileText, Link2, Plus, Upload, X } from 'lucide-react'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { IconButton } from '@/components/icon_button'
import { ProcessingStatusBadge } from '@/components/documents/status'
import { TruncatedName } from '@/components/truncated_name'
import FileUploadForm from '@/components/files/form'
import type { FileUpload } from '@/components/files/card'

const RELOAD = { only: ['files', 'attachableFiles'] }

export function ProjectFiles({
  project,
  files,
  attachableFiles,
}: {
  project: Data.Project
  files: Data.File[]
  attachableFiles: Data.File[]
}) {
  const workspaceId = useWorkspaceId()
  const processing = files.some((file) =>
    ['uploaded', 'queued', 'processing'].includes(file.processingStatus ?? '')
  )
  useEffect(() => {
    if (!processing) return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') router.reload(RELOAD)
    }, 2500)
    return () => clearInterval(interval)
  }, [processing])
  return (
    <section className="mt-12" aria-labelledby="project-files-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <h2 id="project-files-heading" className="text-sm font-medium">
          Files <span className="ml-2 text-muted-foreground">{files.length}</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {attachableFiles.length > 0 && (
            <AttachFile project={project} attachableFiles={attachableFiles} />
          )}
          <UploadToProject project={project} />
        </div>
      </div>
      {files.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-sidebar">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 pr-3 hover:bg-accent">
              <Link
                route="files.edit"
                routeParams={{ workspaceId, id: file.id }}
                className="flex min-w-0 flex-1 items-center gap-4 p-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                  <FileText aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <TruncatedName name={file.filename ?? ''} className="text-sm font-semibold" />
                  <span className="mt-1 block text-[.625rem] text-muted-foreground">
                    {file.filetype?.replace('.', '').toUpperCase()}
                    {(file.projects?.length ?? 0) > 1 &&
                      ` · Shared with ${(file.projects?.length ?? 1) - 1} more project${(file.projects?.length ?? 0) > 2 ? 's' : ''}`}
                  </span>
                </span>
                <ProcessingStatusBadge status={file.processingStatus} />
              </Link>
              {file.capabilities.manageProjects && (
                <Form
                  route="fileProjects.destroy"
                  routeParams={{ workspaceId, id: file.id, projectId: project.id }}
                  options={{ preserveScroll: true }}
                >
                  {({ processing: removing }) => (
                    <IconButton
                      icon={X}
                      label="Remove from project"
                      type="submit"
                      disabled={removing}
                      className="size-8"
                    />
                  )}
                </Form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No project files yet. Files added here are only offered to this project&rsquo;s case
          studies.
        </p>
      )}
    </section>
  )
}

function UploadToProject({ project }: { project: Data.Project }) {
  const [open, setOpen] = useState(false)
  const [uploaded, setUploaded] = useState<FileUpload[]>([])
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setUploaded([])
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload aria-hidden="true" />
          Upload files
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload to {project.name}</DialogTitle>
          <DialogDescription>
            Only this project&rsquo;s case studies can use these files.
          </DialogDescription>
        </DialogHeader>
        <FileUploadForm
          projectId={project.id}
          files={uploaded}
          onSubmit={(file) => {
            setUploaded((current) => [...current, file])
            router.reload(RELOAD)
          }}
          onRemove={(index) => setUploaded((current) => current.filter((_, i) => i !== index))}
        />
      </DialogContent>
    </Dialog>
  )
}

function AttachFile({
  project,
  attachableFiles,
}: {
  project: Data.Project
  attachableFiles: Data.File[]
}) {
  const workspaceId = useWorkspaceId()
  const [open, setOpen] = useState(false)
  const [fileId, setFileId] = useState('')
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Link2 aria-hidden="true" />
          Add existing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a file to {project.name}</DialogTitle>
          <DialogDescription>
            Choose one of your files. Once linked, it is only offered to the projects it belongs to.
          </DialogDescription>
        </DialogHeader>
        <Form
          route="fileProjects.store"
          routeParams={{ workspaceId, id: fileId || attachableFiles[0].id }}
          options={{ preserveScroll: true }}
          onSuccess={() => {
            setFileId('')
            setOpen(false)
          }}
          className="flex items-center gap-2"
        >
          {({ processing }) => (
            <>
              <input type="hidden" name="projectId" value={project.id} />
              <label htmlFor="attach-file" className="sr-only">
                File
              </label>
              <select
                id="attach-file"
                value={fileId}
                onChange={(event) => setFileId(event.target.value)}
                className="form-select min-w-0 flex-1"
              >
                <option value="">Choose a file</option>
                {attachableFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.filename}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={processing || !fileId}>
                <Plus aria-hidden="true" />
                Add
              </Button>
            </>
          )}
        </Form>
      </DialogContent>
    </Dialog>
  )
}
