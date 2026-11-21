import { Head, router } from '@inertiajs/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Data } from '@generated/data'
import {
  SlidersHorizontal,
  Sparkles,
  Check,
  Download,
  ArrowLeft,
  LoaderCircle,
  MoreHorizontal,
  History,
  FilePenLine,
  Plus,
  Trash2,
  Send,
  ListChecks,
  ChevronDown,
  FileText,
  Globe,
  LayoutTemplate,
} from 'lucide-react'
import { Form, Link } from '@adonisjs/inertia/react'
import { urlFor } from '@/client'
import { api, ApiError, feedbackError, safeMessage } from '@/lib/api'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { IconButton } from '@/components/icon_button'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown_menu'
import { ActionFeedback } from '@/components/action_feedback'
import { ConfirmAction } from '@/components/confirm_action'
import { VersionHistory } from '@/components/documents/version_history'
import { BeeWorking } from '@/components/bee/bee_working'
import DocumentEditor from '@/components/documents/editor'
import { DocumentInspector, MetadataForm, type Action } from '@/components/documents/inspector'
import { StatusBadge } from '@/components/documents/status'

type ExportFormat = 'pdf' | 'web'
type Task = {
  id: string
  status: string
  error?: string
  result?: { downloadUrl?: string; format?: ExportFormat }
}
const FORMAT_LABEL: Record<ExportFormat, string> = { pdf: 'PDF', web: 'web page' }
export default function Edit({
  document,
  workflow,
  availableFiles,
  issues = [],
  projects = [],
  unavailableEvidence = false,
  canvas,
}: {
  /** The canvas editor pilot: shown only when it is on. */
  canvas?: { enabled: boolean; mode: 'flow' | 'canvas' }
  document: Data.Document
  workflow: Data.DocumentWorkflow
  availableFiles: Data.File[]
  issues: Data.DocumentIssue[]
  unavailableEvidence?: boolean
  projects: Data.Project[]
}) {
  const workspaceId = useWorkspaceId()
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [notice, setNotice] = useState('')
  const [panel, setPanel] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [ack, setAck] = useState<string[]>([])
  const [exportTask, setExportTask] = useState<Task | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [pollError, setPollError] = useState<ApiError | null>(null)
  const [refresh, setRefresh] = useState(0)
  const mutation = useRef(new Map<string, { hash: string; id: string }>())
  const active = useRef(true)
  const inspectorRef = useRef<HTMLElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const reload = () =>
    router.reload({ only: ['document', 'workflow', 'availableFiles', 'issues', 'recentDocuments'] })
  const action: Action = async (url, method, body) => {
    if (inFlight.current)
      return { ok: false, error: new ApiError('Wait for the current request to finish.', 409) }
    inFlight.current = true
    setBusy(true)
    setNotice('')
    try {
      const result = await api<{ data?: unknown }>(url, method, body)
      if (!result.data || typeof result.data !== 'object')
        throw new ApiError(
          'The change could not be confirmed. Your input is still here. Try again.',
          200,
          {},
          'E_INVALID_RESPONSE'
        )
      if (active.current) {
        reload()
        setNotice('Changes saved.')
      }
      return { ok: true }
    } catch (reason) {
      return { ok: false, error: feedbackError(reason) }
    } finally {
      inFlight.current = false
      if (active.current) setBusy(false)
    }
  }
  function intent(key: string, body: Record<string, unknown>) {
    const hash = JSON.stringify(body)
    const previous = mutation.current.get(key)
    const id = previous?.hash === hash ? previous.id : crypto.randomUUID()
    mutation.current.set(key, { hash, id })
    return { ...body, mutationId: id }
  }
  async function review(approve = false) {
    setError(null)
    const body = approve
      ? {
          baseVersionId: document.currentVersionId,
          reviewId: workflow.review?.id,
          warningAcknowledgments: ack,
        }
      : { baseVersionId: document.currentVersionId }
    const route = approve ? 'documentReviews.approve' : 'documentReviews.store'
    const result = await action(
      urlFor(route, { workspaceId, documentId: document.id }),
      'POST',
      intent(route, body)
    )
    if (result.ok) {
      mutation.current.delete(route)
      setApprovalOpen(false)
    } else if (active.current) setError(result.error)
  }
  async function generate() {
    setError(null)
    const result = await action(
      urlFor('documentTasks.generate', { workspaceId, documentId: document.id }),
      'POST',
      intent('generate', { baseVersionId: document.currentVersionId })
    )
    if (result.ok) {
      mutation.current.delete('generate')
      setGenerateOpen(false)
    } else if (active.current) setError(result.error)
  }
  async function requestExport(format: ExportFormat) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setExportFormat(format)
    const key = `export:${format}`
    try {
      const result = await api<{ data: Task }>(
        urlFor(format === 'web' ? 'exportPdfs.web' : 'exportPdfs.store', {
          workspaceId,
          documentId: document.id,
        }),
        'POST',
        intent(
          key,
          workflow.readiness.reviewRequired
            ? { approvalId: workflow.approval?.id }
            : { baseVersionId: document.currentVersionId }
        )
      )
      if (!result.data?.id || !result.data.status) throw new Error('Unexpected export response')
      if (active.current) {
        setExportTask(result.data)
        mutation.current.delete(key)
        setPollError(null)
      }
    } catch (reason) {
      if (active.current) {
        setError(
          feedbackError(reason, `The ${FORMAT_LABEL[format]} could not be prepared. Try again.`)
        )
        reload()
      }
    } finally {
      inFlight.current = false
      if (active.current) setBusy(false)
    }
  }
  const taskId = exportTask?.id
  const taskStatus = exportTask?.status
  useEffect(() => {
    if (!taskId || !taskStatus || !['queued', 'running'].includes(taskStatus)) return
    const controller = new AbortController()
    let polling = false
    let failed = false
    const poll = async () => {
      if (polling || failed || window.document.visibilityState === 'hidden') return
      polling = true
      try {
        const result = await api<{ data: Task }>(
          urlFor('documentTasks.show', { workspaceId, taskId }),
          'GET',
          undefined,
          controller.signal
        )
        if (!result.data?.id || !result.data.status) throw new Error('Unexpected task response')
        if (!controller.signal.aborted) {
          setExportTask(result.data)
          setPollError(null)
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          failed = true
          setPollError(feedbackError(reason, 'Export status could not refresh. Try again.'))
        }
      } finally {
        polling = false
      }
    }
    void poll()
    const interval = setInterval(() => void poll(), 2000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [taskId, taskStatus, workspaceId, refresh])
  const processing = ['queued', 'processing', 'running'].includes(document.generationStatus ?? '')
  const checkingIssues = document.generationStatus === 'checking_issues'
  useEffect(() => {
    if (!processing && !checkingIssues) return
    const interval = setInterval(() => {
      if (window.document.visibilityState === 'visible') reload()
    }, 2500)
    return () => clearInterval(interval)
  }, [processing, checkingIssues])
  useEffect(() => {
    const refreshWorkflow = () => {
      if (window.document.visibilityState === 'visible')
        router.reload({ only: ['document', 'workflow', 'issues', 'availableFiles'] })
    }
    const timer = setInterval(refreshWorkflow, 10000)
    window.addEventListener('focus', refreshWorkflow)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refreshWorkflow)
    }
  }, [])
  const disabled = busy || dirty || processing
  const version =
    document.documentVersions?.find((item) => item.id === document.currentVersionId) ??
    document.documentVersions?.[0]
  const currentReview = !!workflow.review && !workflow.review.invalidatedAt
  const canApprove = document.capabilities.approve && currentReview && !workflow.readiness.approved
  const exporting = !!taskStatus && ['queued', 'running'].includes(taskStatus)
  const reviewRequired = workflow.readiness.reviewRequired !== false
  const blocker = workflow.readiness.stages.some((stage) => !stage.complete)
  const onDirty = useCallback((value: boolean) => setDirty(value), [])
  function showDetails() {
    setPanel(true)
    requestAnimationFrame(() => inspectorRef.current?.focus())
  }
  return (
    <div className="min-w-0">
      <Head title={document.title} />
      <header className="border-b bg-sidebar px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="icon">
            <Link
              route="documents.index"
              routeParams={{ workspaceId }}
              aria-label="Back to case studies"
            >
              <ArrowLeft />
            </Link>
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold" title={document.title}>
            {document.title}
          </h1>
          <StatusBadge status={document.status} />
          <IconButton
            icon={SlidersHorizontal}
            label="Details"
            className={reviewRequired ? 'hidden' : 'xl:hidden'}
            aria-controls="document-details"
            aria-expanded={panel}
            onClick={() => (panel ? setPanel(false) : showDetails())}
          />
          {(!reviewRequired && version) || workflow.readiness.approved ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={disabled || exporting || !workflow.readiness.canExport}>
                  <Download />
                  {exporting ? 'Preparing…' : 'Download'}
                  <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuItem onSelect={() => void requestExport('pdf')}>
                  <FileText />
                  PDF document
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void requestExport('web')}>
                  <Globe />
                  Web page (.html)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : !version ? (
            <Button
              ref={primaryRef}
              size="sm"
              disabled={disabled || !document.capabilities.edit}
              onClick={() => void generate()}
            >
              <Sparkles />
              {processing ? 'Generating…' : 'Generate'}
            </Button>
          ) : canApprove ? (
            <Button
              ref={primaryRef}
              size="sm"
              disabled={disabled || !workflow.readiness.canSubmit}
              onClick={() => {
                setAck([])
                setError(null)
                setApprovalOpen(true)
              }}
            >
              <Check />
              Approve
            </Button>
          ) : (
            <Button
              ref={primaryRef}
              size="sm"
              disabled={disabled || !workflow.readiness.canSubmit || currentReview}
              onClick={() => void review()}
            >
              <Send aria-hidden="true" />
              {currentReview ? 'In review' : 'Submit'}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton ref={moreRef} icon={MoreHorizontal} label="More" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem
                disabled={!document.documentVersions?.length}
                onSelect={() => setHistoryOpen(true)}
              >
                <History />
                History
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={disabled || !document.capabilities.edit}
                onSelect={() => setMetadataOpen(true)}
              >
                <FilePenLine />
                Information
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={disabled || !document.capabilities.edit}
                onSelect={() => {
                  setError(null)
                  setGenerateOpen(true)
                }}
              >
                <Sparkles />
                {version ? 'Generate again' : 'Generate draft'}
              </DropdownMenuItem>
              {canvas?.enabled && (
                <DropdownMenuItem
                  disabled={dirty || !version || !document.capabilities.edit}
                  asChild
                >
                  <Link
                    route="documentCanvases.show"
                    routeParams={{ workspaceId, documentId: document.id }}
                  >
                    <LayoutTemplate />
                    {canvas.mode === 'canvas' ? 'Open canvas layout' : 'Lay out in canvas'}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={dirty || !version} asChild>
                <a
                  href={urlFor('documentPreview.show', { workspaceId, documentId: document.id })}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download />
                  Preview document
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={dirty || !version} asChild>
                <a
                  href={urlFor('documentPreview.web', { workspaceId, documentId: document.id })}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Globe />
                  Preview web page
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href={`${urlFor('documents.create', { workspaceId })}${document.projectId ? `?projectId=${document.projectId}` : ''}`}
                >
                  <Plus />
                  New case study
                </Link>
              </DropdownMenuItem>
              {document.capabilities.delete && (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={busy}
                  onSelect={() => setDeleteOpen(true)}
                >
                  <Trash2 />
                  Delete case study
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {dirty ? (
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            Save your changes to continue.
          </p>
        ) : reviewRequired && blocker && !workflow.readiness.approved ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <Button size="xs" variant="link" className="text-foreground" onClick={showDetails}>
              <ListChecks aria-hidden="true" />
              Checklist
            </Button>
          </div>
        ) : null}
        {!approvalOpen && !generateOpen && (
          <div className={error ? 'mt-3' : ''}>
            <ActionFeedback error={error} />
          </div>
        )}
      </header>
      <VersionHistory
        versions={document.documentVersions ?? []}
        open={historyOpen}
        returnFocus={() => moreRef.current?.focus()}
        onOpenChange={setHistoryOpen}
      />
      <MetadataForm
        document={document}
        projects={projects}
        action={action}
        disabled={disabled}
        open={metadataOpen}
        returnFocus={() => moreRef.current?.focus()}
        onOpenChange={setMetadataOpen}
      />
      <ConfirmAction
        title="Delete this case study?"
        description="This permanently removes the case study and its versions. Shared files remain in the library."
        open={deleteOpen}
        returnFocus={() => moreRef.current?.focus()}
        onOpenChange={setDeleteOpen}
      >
        <Form route="documents.destroy" routeParams={{ workspaceId, id: document.id }}>
          {({ processing: deleting }) => (
            <Button variant="destructive" disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete case study'}
            </Button>
          )}
        </Form>
      </ConfirmAction>
      <Dialog
        open={generateOpen}
        onOpenChange={(open) => {
          if (!busy) setGenerateOpen(open)
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            moreRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>{version ? 'Generate a new draft?' : 'Generate a draft?'}</DialogTitle>
            <DialogDescription>
              Uses your brief and sources. Saved versions stay in History.
            </DialogDescription>
          </DialogHeader>
          <ActionFeedback error={error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={disabled} onClick={() => void generate()}>
              <Sparkles aria-hidden="true" />
              {busy ? 'Starting…' : 'Generate'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={approvalOpen}
        onOpenChange={(open) => {
          if (!busy) setApprovalOpen(open)
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            primaryRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>Approve version {version?.version}?</DialogTitle>
            <DialogDescription>
              Changes to this version or its sources require a new approval.
            </DialogDescription>
          </DialogHeader>
          <ActionFeedback error={error} />
          {workflow.readiness.warnings.map((warning) => (
            <label
              key={warning.id}
              className="flex items-start gap-3 rounded-lg border p-3 text-sm"
            >
              <Checkbox
                checked={ack.includes(warning.id)}
                onCheckedChange={(value) =>
                  setAck((current) =>
                    value === true
                      ? [...current, warning.id]
                      : current.filter((id) => id !== warning.id)
                  )
                }
              />
              {warning.text}
            </label>
          ))}
          <Button
            disabled={
              disabled ||
              !workflow.readiness.canSubmit ||
              workflow.readiness.warnings.some((warning) => !ack.includes(warning.id))
            }
            onClick={() => void review(true)}
          >
            <Check aria-hidden="true" />
            {busy ? 'Approving…' : 'Approve version'}
          </Button>
        </DialogContent>
      </Dialog>
      {notice && (
        <p role="status" className="sr-only">
          {notice}
        </p>
      )}
      {exportTask && (
        <div className="space-y-3 border-b bg-sidebar p-4 text-xs">
          <div role="status" className="flex flex-wrap items-center gap-3">
            {exporting ? (
              <>
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Preparing {FORMAT_LABEL[exportFormat]}…
              </>
            ) : exportTask.status === 'succeeded' && exportTask.result?.downloadUrl ? (
              <>
                <Check aria-hidden="true" className="size-4" />
                {exportTask.result.format === 'web' ? 'Web page' : 'PDF'} ready.
                <Button size="sm" asChild>
                  <a href={exportTask.result.downloadUrl}>
                    Download {FORMAT_LABEL[exportTask.result.format ?? 'pdf']}
                  </a>
                </Button>
              </>
            ) : (
              <span className="text-destructive">
                {safeMessage(
                  exportTask.error,
                  `Export stopped. Request a new ${FORMAT_LABEL[exportFormat]}.`
                )}
              </span>
            )}
          </div>
          <ActionFeedback
            error={pollError}
            onRetry={() => {
              setPollError(null)
              setRefresh((value) => value + 1)
            }}
          />
        </div>
      )}
      {unavailableEvidence && (
        <p role="status" className="border-b bg-primary/10 px-5 py-3 text-xs">
          Some sources are unavailable. Their citations and images are hidden. Check the file
          library before review.
        </p>
      )}
      <BeeWorking
        documentId={document.id}
        active={processing}
        failed={document.generationStatus === 'failed'}
      />
      {document.generationStatus === 'failed' && (
        <div className="space-y-2 border-b p-4">
          <p role="alert" className="text-xs text-destructive">
            {safeMessage(
              document.generationError,
              'Draft generation failed. Your saved content is safe.'
            )}
          </p>
          <Button variant="outline" size="sm" disabled={disabled} onClick={() => void generate()}>
            <Sparkles aria-hidden="true" />
            Retry generation
          </Button>
        </div>
      )}
      <div className="flex min-w-0 flex-col items-start xl:flex-row">
        <DocumentEditor
          key={document.id}
          title={document.title}
          generationStatus={document.generationStatus}
          documentId={document.id}
          baseVersionId={document.currentVersionId}
          initialContent={version?.content ?? null}
          onDirtyChange={onDirty}
        />
        <aside
          ref={inspectorRef}
          id="document-details"
          tabIndex={-1}
          aria-label="Document details"
          className={`${reviewRequired || panel ? 'block' : 'hidden'} order-first w-full shrink-0 border-b bg-sidebar outline-none xl:sticky xl:top-0 xl:order-last xl:block xl:max-h-dvh xl:w-72 xl:overflow-y-auto xl:border-b-0 xl:border-l`}
        >
          <DocumentInspector
            key={document.id}
            document={document}
            workflow={workflow}
            availableFiles={availableFiles}
            issues={issues}
            loadingIssues={checkingIssues}
            action={action}
            disabled={disabled}
          />
        </aside>
      </div>
    </div>
  )
}
