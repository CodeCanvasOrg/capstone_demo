import { RichTextEditor, textToRichText, type RichText } from '@/components/rich_text_editor'
import { SourcePicker } from '@/components/files/source_picker'
import { useState, type FormEvent } from 'react'
import type { Data } from '@generated/data'
import { Link, Form } from '@adonisjs/inertia/react'
import { Check, Plus, FileText, CalendarDays, UserRound, AlertCircle } from 'lucide-react'
import { urlFor } from '@/client'
import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ConfirmAction } from '@/components/confirm_action'
import { ProjectFields, TitleField } from './project_fields'
import { informationToContent } from '../../../shared/project_information.ts'
import { ProcessingStatusBadge } from './status'
export type Action = (url: string, method: string, body: unknown) => Promise<boolean>
export function MetadataForm({
  document,
  projects,
  action,
  disabled,
}: {
  document: Data.Document
  projects: Data.Project[]
  action: Action
  disabled: boolean
}) {
  const workspaceId = useWorkspaceId()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(document.title)
  const [informationContent, setInformationContent] = useState(
    document.projectInformationContent ?? informationToContent(document.projectInformation)
  )
  const [dueDate, setDueDate] = useState(document.dueDate?.slice(0, 10) ?? '')
  const [projectId, setProjectId] = useState(document.projectId ?? '')
  const [revision, setRevision] = useState(document.metadataRevision)
  const [changed, setChanged] = useState(false)
  useUnsavedChanges('project-information', open && changed)
  function begin(next: boolean) {
    if (!next && changed && !window.confirm('Discard changes to project information?')) return
    if (next) {
      setTitle(document.title)
      setInformationContent(
        document.projectInformationContent ?? informationToContent(document.projectInformation)
      )
      setDueDate(document.dueDate?.slice(0, 10) ?? '')
      setProjectId(document.projectId ?? '')
      setRevision(document.metadataRevision)
      setChanged(false)
    }
    setOpen(next)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (
      await action(urlFor('documents.update', { workspaceId, id: document.id }), 'PUT', {
        title,
        description: document.description,
        descriptionContent: document.descriptionContent,
        projectInformationContent: informationContent,
        dueDate: dueDate || null,
        projectId: projectId || null,
        metadataRevision: revision,
      })
    ) {
      setChanged(false)
      setOpen(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          Project information
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto px-6 py-8 sm:max-w-4xl sm:px-12 sm:py-10">
        <DialogHeader className="text-left">
          <DialogTitle className="pr-8 text-xs font-medium text-muted-foreground">
            Project information
          </DialogTitle>
          <DialogDescription className="sr-only">
            Capture the story behind your case study. Complete each section before review. Changing
            the writing inputs invalidates an existing approval.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} onChange={() => setChanged(true)} className="space-y-5">
          <TitleField value={title} onChange={setTitle} disabled={disabled} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="document-deadline">Deadline</Label>
              <Input
                id="document-deadline"
                type="date"
                value={dueDate}
                disabled={disabled}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-project">Project</Label>
              <select
                id="document-project"
                className="form-select"
                value={projectId}
                disabled={disabled}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">Ungrouped</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="border-t pt-4">
            <ProjectFields
              value={informationContent}
              disabled={disabled}
              onChange={(value) => {
                setInformationContent(value)
                setChanged(true)
              }}
            />
          </div>
          <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Changes require a fresh review and approval.
            </p>
            <Button disabled={disabled}>Save information</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export function IssuesPanel({
  issues,
  action,
  documentId,
  disabled,
}: {
  issues: Data.DocumentIssue[]
  action: Action
  documentId: string
  disabled: boolean
}) {
  const workspaceId = useWorkspaceId()
  const [editing, setEditing] = useState<Data.DocumentIssue | null>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionContent, setDescriptionContent] = useState<RichText>(textToRichText(''))
  const [blocking, setBlocking] = useState(false)
  const [changed, setChanged] = useState(false)
  useUnsavedChanges('issue-form', open && changed)
  function begin(issue: Data.DocumentIssue | null) {
    setEditing(issue)
    setTitle(issue?.title ?? '')
    setDescription(issue?.description ?? '')
    setDescriptionContent(issue?.descriptionContent ?? textToRichText(issue?.description ?? ''))
    setBlocking(issue?.blocking ?? false)
    setChanged(false)
    setOpen(true)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    const url = editing
      ? urlFor('documentIssues.update', { workspaceId, documentId, issueId: editing.id })
      : urlFor('documentIssues.store', { workspaceId, documentId })
    if (
      await action(url, editing ? 'PATCH' : 'POST', {
        title,
        description,
        descriptionContent,
        blocking,
        ...(editing ? { state: editing.state, revision: editing.revision } : {}),
      })
    ) {
      setChanged(false)
      setOpen(false)
    }
  }
  return (
    <section className="space-y-4 border-t p-5">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">
          Issues · {issues.filter((issue) => issue.state === 'open').length} open
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Add issue"
          onClick={() => begin(null)}
          disabled={disabled}
        >
          <Plus />
        </Button>
      </div>
      {issues.length ? (
        <ul className="space-y-3">
          {issues.map((issue) => (
            <li key={issue.id} className="rounded-lg border bg-background/40 p-3">
              <button
                type="button"
                className="flex w-full items-start gap-2 text-left text-xs font-medium hover:underline"
                onClick={() => begin(issue)}
              >
                {issue.state === 'resolved' ? (
                  <Check className="size-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="size-3.5 shrink-0" />
                )}
                <span className="break-words">{issue.title}</span>
              </button>
              <p className="mt-2 text-[.625rem] text-muted-foreground">
                {issue.blocking ? 'Blocks review' : 'Informational'} · {issue.state}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 px-2 text-[.625rem]"
                disabled={disabled}
                onClick={() =>
                  void action(
                    urlFor('documentIssues.update', { workspaceId, documentId, issueId: issue.id }),
                    'PATCH',
                    {
                      title: issue.title,
                      blocking: issue.blocking,
                      state: issue.state === 'open' ? 'resolved' : 'open',
                      revision: issue.revision,
                    }
                  )
                }
              >
                {issue.state === 'open' ? 'Mark resolved' : 'Reopen issue'}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Track feedback here. Open blocking issues prevent review and approval.
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value && changed && !window.confirm('Discard unsaved changes to this issue?')) return
          setOpen(value)
        }}
      >
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
          <DialogHeader className="px-6 pt-6 text-left sm:px-10">
            <DialogTitle className="pr-8 text-xs font-medium text-muted-foreground">
              {editing ? 'Edit issue' : 'New issue'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Make feedback clear and actionable for everyone in the workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} onChange={() => setChanged(true)}>
            <div className="px-6 pt-7 sm:px-10">
              <Label htmlFor="issue-title" className="sr-only">
                Issue title
              </Label>
              <input
                id="issue-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Issue title"
                disabled={disabled}
                className="w-full rounded-md bg-transparent py-2 text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-foreground/25 disabled:opacity-50"
                maxLength={255}
                required
              />
            </div>
            <div className="mx-6 mt-5 border-t py-6 sm:mx-10">
              <RichTextEditor
                value={descriptionContent}
                onChange={(value, text) => {
                  setDescriptionContent(value)
                  setDescription(text)
                  setChanged(true)
                }}
                label="Issue description"
                placeholder="Describe the issue, add context, or collect feedback…"
                className="issue-document"
                disabled={disabled}
              />
            </div>
            <div className="flex flex-col gap-4 rounded-b-2xl border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={blocking}
                  disabled={disabled}
                  onCheckedChange={(value) => {
                    setBlocking(value === true)
                    setChanged(true)
                  }}
                />
                Blocks review and approval
              </label>
              <Button disabled={disabled || !title.trim()}>
                {disabled ? 'Saving…' : editing ? 'Save changes' : 'Create issue'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
export function DocumentInspector({
  document,
  workflow,
  availableFiles,
  issues,
  action,
  disabled,
}: {
  document: Data.Document
  workflow: Data.DocumentWorkflow
  availableFiles: Data.File[]
  issues: Data.DocumentIssue[]
  action: Action
  disabled: boolean
}) {
  const workspaceId = useWorkspaceId()
  const [files, setFiles] = useState((document.files ?? []).map((file) => file.id))
  const [sourceMode, setSourceMode] = useState(document.sourceMode)
  const [baseline, setBaseline] = useState({
    ids: (document.files ?? []).map((file) => file.id),
    mode: document.sourceMode,
    revision: document.selectionRevision,
  })
  const selectionRevision = baseline.revision
  const baseVersionId = document.currentVersionId
  const selected = new Set(baseline.ids)
  const selectionDirty =
    sourceMode !== baseline.mode ||
    files.length !== selected.size ||
    files.some((id) => !selected.has(id))
  if (!selectionDirty && document.selectionRevision !== baseline.revision) {
    const ids = (document.files ?? []).map((file) => file.id)
    setFiles(ids)
    setSourceMode(document.sourceMode)
    setBaseline({ ids, mode: document.sourceMode, revision: document.selectionRevision })
  }
  useUnsavedChanges('source-selection', selectionDirty)
  return (
    <div className="text-sm">
      <section className="space-y-4 p-5">
        <h2 className="eyebrow">Properties</h2>
        <dl className="space-y-4 text-[.6875rem]">
          <div className="flex justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-3.5" />
              Created
            </dt>
            <dd>{document.createdAt ? new Date(document.createdAt).toLocaleDateString() : '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Deadline</dt>
            <dd>{document.dueDate?.slice(0, 10) || 'Not set'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <UserRound className="size-3.5" />
              Owner
            </dt>
            <dd className="max-w-40 truncate">{document.user?.fullName || document.user?.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Version</dt>
            <dd>{document.documentVersions?.[0]?.version ?? 'No saved content'}</dd>
          </div>
        </dl>
      </section>
      <section className="space-y-4 border-t p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Readiness checklist</p>
            <p className="mt-2 text-xs font-medium">
              {workflow.readiness.approved
                ? 'Approved'
                : workflow.review && !workflow.review.invalidatedAt
                  ? 'In review'
                  : 'Draft in progress'}
            </p>
          </div>
          <strong className="text-xl tracking-tight">{workflow.readiness.percentage}%</strong>
        </div>
        <Progress value={workflow.readiness.percentage} aria-label="Checklist completion" />
        <ol className="space-y-4">
          {workflow.readiness.stages.map((stage, index) => (
            <li key={stage.key} className="flex gap-3">
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[.625rem] ${stage.complete ? 'border-foreground bg-foreground text-background' : 'bg-background'}`}
              >
                {stage.complete ? <Check className="size-3" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[.6875rem] font-semibold">{stage.label}</p>
                <p className="mt-1 text-[.625rem] leading-relaxed text-muted-foreground">
                  {stage.complete ? 'Complete' : stage.reasons.join(' ') || 'Not complete'}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[.625rem] leading-relaxed text-muted-foreground">
          Each stage contributes 25%. This checklist does not measure evidence accuracy or
          processing time.
        </p>
      </section>
      <section className="space-y-4 border-t p-5">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">Evidence</h2>
          <SourcePicker
            files={availableFiles}
            selected={files}
            onChange={(ids) => {
              setFiles(ids)
              if (ids.length) setSourceMode('files')
            }}
            disabled={disabled}
          />
        </div>
        <p className="text-xs font-semibold">Case-study files</p>
        <label className="flex items-start gap-2 text-[.6875rem]">
          <Checkbox
            checked={sourceMode === 'input_only'}
            disabled={disabled}
            onCheckedChange={(value) => {
              setSourceMode(value ? 'input_only' : 'files')
              if (value) setFiles([])
            }}
          />
          Write from project information only
        </label>
        {sourceMode === 'files' && (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {availableFiles
              .filter((file) => files.includes(file.id))
              .map((file) => (
                <li key={file.id} className="rounded-lg border p-3">
                  <label className="flex items-start gap-2">
                    <Checkbox
                      checked={files.includes(file.id)}
                      disabled={disabled}
                      onCheckedChange={(value) =>
                        setFiles((current) =>
                          value ? [...current, file.id] : current.filter((id) => id !== file.id)
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[.6875rem] font-medium">
                        {file.filename}
                      </span>
                      <span className="mt-1 block">
                        <ProcessingStatusBadge status={file.processingStatus} />
                      </span>
                    </span>
                  </label>
                  <Link
                    route="files.edit"
                    routeParams={{ workspaceId, id: file.id }}
                    className="mt-2 inline-flex items-center gap-1 text-[.625rem] text-muted-foreground underline"
                  >
                    <FileText className="size-3" />
                    Inspect file
                  </Link>
                </li>
              ))}
          </ul>
        )}
        {!availableFiles.length && sourceMode === 'files' && (
          <p className="text-xs text-muted-foreground">
            Upload evidence or explicitly select input-only writing.
          </p>
        )}
        {selectionDirty && (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={async () => {
              if (
                await action(
                  urlFor('documentTasks.sources', { workspaceId, documentId: document.id }),
                  'PUT',
                  { baseVersionId, selectionRevision, sourceMode, fileIds: files }
                )
              )
                setBaseline({ ids: files, mode: sourceMode, revision: selectionRevision })
            }}
          >
            Save source selection
          </Button>
        )}
        {workflow.readiness.warnings.map((warning) => (
          <p
            key={warning.id}
            className="rounded-lg border border-primary/40 p-3 text-[.625rem] leading-relaxed"
          >
            {warning.text}
          </p>
        ))}
      </section>
      <IssuesPanel issues={issues} action={action} documentId={document.id} disabled={disabled} />
      <section className="space-y-3 border-t p-5">
        <h2 className="eyebrow">Approval history</h2>
        {workflow.approvalHistory.length ? (
          workflow.approvalHistory.map((approval) => (
            <div key={approval.id} className="rounded-lg border p-3 text-[.625rem]">
              <p>
                {approval.invalidatedAt ? 'Superseded approval' : 'Owner approved'} ·{' '}
                {approval.createdAt ? new Date(approval.createdAt).toLocaleString() : '—'}
              </p>
              <p className="mt-1 break-words text-muted-foreground">
                {approval.invalidationReason || 'Approved saved version'} · Owner #
                {approval.approvedById}
              </p>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            Owner approvals appear here with their saved version.
          </p>
        )}
      </section>
      {document.capabilities.delete && (
        <section className="border-t p-5">
          <ConfirmAction
            trigger="Delete case study"
            title="Delete case study?"
            description="This permanently removes this case study and its versions. Files remain in the shared library."
          >
            <Form route="documents.destroy" routeParams={{ workspaceId, id: document.id }}>
              <Button variant="destructive">Delete case study</Button>
            </Form>
          </ConfirmAction>
        </section>
      )}
    </div>
  )
}
