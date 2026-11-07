import { RichTextEditor, textToRichText, type RichText } from '@/components/rich_text_editor'
import { SourcePicker } from '@/components/files/source_picker'
import { useRef, useState, type FormEvent } from 'react'
import type { Data } from '@generated/data'
import { Link } from '@adonisjs/inertia/react'
import {
  Check,
  Plus,
  FileText,
  CalendarDays,
  UserRound,
  AlertCircle,
  Circle,
  ListChecks,
  MessageSquare,
  Info,
  Save,
  RotateCcw,
  PencilLine,
} from 'lucide-react'
import { urlFor } from '@/client'
import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Disclosure } from '@/components/disclosure'
import { ActionFeedback, FieldError, focusInvalid } from '@/components/action_feedback'
import type { ActionResult, ApiError } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ProjectFields, TitleField } from './project_fields'
import { informationToContent } from '../../../shared/project_information.ts'
import { ProcessingStatusBadge } from './status'
import { TruncatedName } from '@/components/truncated_name'
export type Action = (url: string, method: string, body: unknown) => Promise<ActionResult>
export function MetadataForm({
  document,
  projects,
  action,
  disabled,
  open: controlledOpen,
  onOpenChange,
  returnFocus,
}: {
  returnFocus?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  document: Data.Document
  projects: Data.Project[]
  action: Action
  disabled: boolean
}) {
  const workspaceId = useWorkspaceId()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [error, setError] = useState<ApiError | null>(null)
  const [title, setTitle] = useState(document.title)
  const [informationContent, setInformationContent] = useState(
    document.projectInformationContent ?? informationToContent(document.projectInformation)
  )
  const [dueDate, setDueDate] = useState(document.dueDate?.slice(0, 10) ?? '')
  const [projectId, setProjectId] = useState(document.projectId ?? '')
  const [revision, setRevision] = useState(document.metadataRevision)
  const [changed, setChanged] = useState(false)
  const [previousOpen, setPreviousOpen] = useState(open)
  if (open !== previousOpen) {
    setPreviousOpen(open)
    if (open) {
      setTitle(document.title)
      setInformationContent(
        document.projectInformationContent ?? informationToContent(document.projectInformation)
      )
      setDueDate(document.dueDate?.slice(0, 10) ?? '')
      setProjectId(document.projectId ?? '')
      setRevision(document.metadataRevision)
      setChanged(false)
      setError(null)
    }
  }

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
      setError(null)
    }
    setOpen(next)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget as HTMLFormElement
    const result = await action(
      urlFor('documents.update', { workspaceId, id: document.id }),
      'PUT',
      {
        title,
        description: document.description,
        descriptionContent: document.descriptionContent,
        projectInformationContent: informationContent,
        dueDate: dueDate || null,
        projectId: projectId || null,
        metadataRevision: revision,
      }
    )
    if (result.ok) {
      setChanged(false)
      setError(null)
      setOpen(false)
    } else {
      setError(result.error)
      focusInvalid(form)
    }
  }

  return (
    <Dialog open={open} onOpenChange={begin}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled}>
            <PencilLine aria-hidden="true" />
            Information
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        onCloseAutoFocus={(event) => {
          if (returnFocus) {
            event.preventDefault()
            returnFocus()
          }
        }}
        className="max-h-[90dvh] overflow-y-auto px-6 py-8 sm:max-w-4xl sm:px-12 sm:py-10"
      >
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
          <ActionFeedback error={error} />
          <TitleField
            value={title}
            onChange={setTitle}
            disabled={disabled}
            error={error?.details.title}
          />
          <Disclosure
            title="More options"
            summary={dueDate || (projectId ? 'Project selected' : 'Optional')}
            reveal={!!(error?.details.dueDate || error?.details.projectId)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="document-deadline">Deadline</Label>
                <Input
                  id="document-deadline"
                  aria-invalid={!!error?.details.dueDate}
                  aria-describedby={error?.details.dueDate ? 'deadline-error' : undefined}
                  type="date"
                  value={dueDate}
                  disabled={disabled}
                  onChange={(event) => setDueDate(event.target.value)}
                />
                <FieldError id="deadline-error" message={error?.details.dueDate} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-project">Project</Label>
                <select
                  id="document-project"
                  aria-invalid={!!error?.details.projectId}
                  aria-describedby={error?.details.projectId ? 'project-error' : undefined}
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
                <FieldError id="project-error" message={error?.details.projectId} />
              </div>
            </div>
          </Disclosure>
          <div className="border-t pt-4">
            <ProjectFields
              error={
                Object.entries(error?.details ?? {}).find(([key]) =>
                  key.startsWith('projectInformation')
                )?.[1]
              }
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
            <Button disabled={disabled}>
              <Save aria-hidden="true" />
              {disabled ? 'Saving…' : 'Save'}
            </Button>
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
  const issueReturnFocus = useRef<HTMLElement | null>(null)
  const [editing, setEditing] = useState<Data.DocumentIssue | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [panelError, setPanelError] = useState<ApiError | null>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionContent, setDescriptionContent] = useState<RichText>(textToRichText(''))
  const [blocking, setBlocking] = useState(false)
  const [changed, setChanged] = useState(false)
  useUnsavedChanges('issue-form', open && changed)
  function begin(issue: Data.DocumentIssue | null) {
    issueReturnFocus.current = window.document.activeElement as HTMLElement | null
    setError(null)
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
    const form = event.currentTarget as HTMLFormElement
    const result = await action(url, editing ? 'PATCH' : 'POST', {
      title,
      description,
      descriptionContent,
      blocking,
      ...(editing ? { state: editing.state, revision: editing.revision } : {}),
    })
    if (result.ok) {
      setChanged(false)
      setError(null)
      setOpen(false)
    } else {
      setError(result.error)
      focusInvalid(form)
    }
  }

  return (
    <Disclosure
      title="Issues"
      icon={MessageSquare}
      summary={`${issues.filter((issue) => issue.state === 'open').length} open`}
      defaultOpen={issues.some((issue) => issue.state === 'open' && issue.blocking)}
    >
      <ActionFeedback error={panelError} />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Feedback</span>
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
              <p className="mt-2 text-xs text-muted-foreground">
                {issue.blocking ? 'Blocks review' : 'Informational'} · {issue.state}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 px-2 text-xs"
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
                  ).then((result) => setPanelError(result.ok ? null : result.error))
                }
              >
                {issue.state === 'open' ? (
                  <Check aria-hidden="true" />
                ) : (
                  <RotateCcw aria-hidden="true" />
                )}
                {issue.state === 'open' ? 'Resolve' : 'Reopen'}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">No issues.</p>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value && changed && !window.confirm('Discard unsaved changes to this issue?')) return
          setOpen(value)
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            issueReturnFocus.current?.focus()
          }}
          className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-4xl"
        >
          <DialogHeader className="px-6 pt-6 text-left sm:px-10">
            <DialogTitle className="pr-8 text-xs font-medium text-muted-foreground">
              {editing ? 'Edit issue' : 'New issue'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Make feedback clear and actionable for everyone in the workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} onChange={() => setChanged(true)}>
            <div className="px-6 pt-4 sm:px-10">
              <ActionFeedback error={error} />
            </div>
            <div className="px-6 pt-7 sm:px-10">
              <Label htmlFor="issue-title" className="sr-only">
                Issue title
              </Label>
              <input
                id="issue-title"
                aria-invalid={!!error?.details.title}
                aria-describedby={error?.details.title ? 'issue-title-error' : undefined}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Issue title"
                disabled={disabled}
                className="w-full rounded-md bg-transparent py-2 text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-foreground/25 disabled:opacity-50"
                maxLength={255}
                required
              />
              <FieldError id="issue-title-error" message={error?.details.title} />
            </div>
            <div className="mx-6 mt-5 border-t py-6 sm:mx-10">
              <RichTextEditor
                value={descriptionContent}
                onChange={(value, text) => {
                  setDescriptionContent(value)
                  setDescription(text)
                  setChanged(true)
                }}
                error={error?.details.description || error?.details.descriptionContent}
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
                <Save aria-hidden="true" />
                {disabled ? 'Saving…' : editing ? 'Save' : 'Add issue'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Disclosure>
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
  const [sourceError, setSourceError] = useState<ApiError | null>(null)
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
  const checklist = (
    <ul className="space-y-4">
      {workflow.readiness.stages.map((stage) => (
        <li key={stage.key} className="flex items-center gap-3">
          {stage.complete ? (
            <Check aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <Circle aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="sr-only">{stage.complete ? 'Complete' : 'Incomplete'}:</span>
          <h3 className="text-xs font-semibold">{stage.label}</h3>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="text-sm">
      {workflow.readiness.reviewRequired !== false ? (
        <section className="space-y-4 border-t p-5" aria-label="Review checklist">
          <h2 className="flex items-center gap-2 text-xs font-semibold">
            <ListChecks aria-hidden="true" className="size-4" />
            Checklist
          </h2>
          {checklist}
        </section>
      ) : (
        <Disclosure title="Checklist" icon={ListChecks}>
          {checklist}
        </Disclosure>
      )}
      <Disclosure
        title="Sources"
        icon={FileText}
        summary={sourceMode === 'input_only' ? 'Brief only' : `${files.length} files`}
        reveal={selectionDirty || !!sourceError}
      >
        <ActionFeedback error={sourceError} />
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">Evidence</h2>
          <SourcePicker
            files={availableFiles}
            projectId={document.projectId}
            selected={files}
            onChange={(ids) => {
              setFiles(ids)
              if (ids.length) setSourceMode('files')
            }}
            disabled={disabled}
          />
        </div>
        <label className="flex items-start gap-2 text-xs">
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
                      <TruncatedName name={file.filename ?? ''} className="text-xs font-medium" />
                      <span className="mt-1 block">
                        <ProcessingStatusBadge status={file.processingStatus} />
                      </span>
                    </span>
                  </label>
                  <Link
                    route="files.edit"
                    routeParams={{ workspaceId, id: file.id }}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline"
                  >
                    <FileText className="size-3" />
                    Inspect file
                  </Link>
                </li>
              ))}
          </ul>
        )}
        {!availableFiles.length && sourceMode === 'files' && (
          <p className="text-xs text-muted-foreground">Add files or use your brief.</p>
        )}
        {selectionDirty && (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={async () => {
              setSourceError(null)
              const result = await action(
                urlFor('documentTasks.sources', { workspaceId, documentId: document.id }),
                'PUT',
                { baseVersionId, selectionRevision, sourceMode, fileIds: files }
              )
              setSourceError(result.ok ? null : result.error)
              if (result.ok)
                setBaseline({ ids: files, mode: sourceMode, revision: selectionRevision })
            }}
          >
            <Save aria-hidden="true" />
            Save sources
          </Button>
        )}
      </Disclosure>
      {workflow.readiness.warnings.length > 0 && (
        <div className="space-y-2 border-t px-5 py-4">
          {workflow.readiness.warnings.map((warning) => (
            <p key={warning.id} className="text-xs leading-relaxed text-muted-foreground">
              {warning.text}
            </p>
          ))}
        </div>
      )}
      <IssuesPanel issues={issues} action={action} documentId={document.id} disabled={disabled} />
      <Disclosure title="Details" icon={Info}>
        <div className="space-y-4">
          <dl className="space-y-4 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="size-3.5" />
                Created
              </dt>
              <dd>
                {document.createdAt ? new Date(document.createdAt).toLocaleDateString() : '—'}
              </dd>
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
              <dd className="max-w-40 truncate">
                {document.user?.fullName || document.user?.email}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Version</dt>
              <dd>{document.documentVersions?.[0]?.version ?? 'No saved content'}</dd>
            </div>
          </dl>
        </div>

        <h3 className="text-xs font-semibold">Approval history</h3>
        {workflow.approvalHistory.length ? (
          workflow.approvalHistory.map((approval) => (
            <div key={approval.id} className="rounded-lg border p-3 text-xs">
              <p>
                {approval.invalidatedAt ? 'Superseded approval' : 'Owner approved'} ·{' '}
                {approval.createdAt ? new Date(approval.createdAt).toLocaleString() : '—'}
              </p>
              <p className="mt-1 break-words text-muted-foreground">
                {approval.invalidationReason || 'Approved saved version'}
              </p>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No approvals yet.</p>
        )}
      </Disclosure>
    </div>
  )
}
