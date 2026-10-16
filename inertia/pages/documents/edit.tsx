import { Head, router } from '@inertiajs/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Data } from '@generated/data'
import {
  SlidersHorizontal,
  Plus,
  Sparkles,
  Check,
  Download,
  ArrowLeft,
  LoaderCircle,
} from 'lucide-react'
import { Link } from '@adonisjs/inertia/react'
import { urlFor } from '@/client'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useWorkspaceId, useWorkspace } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { VersionHistory } from '@/components/documents/version_history'
import DocumentEditor from '@/components/documents/editor'
import { DocumentInspector, MetadataForm, type Action } from '@/components/documents/inspector'
import { StatusBadge } from '@/components/documents/status'
type Task = { id: string; status: string; error?: string; result?: { downloadUrl?: string } }
export default function Edit({
  document,
  workflow,
  availableFiles,
  issues = [],
  projects = [],
  unavailableEvidence = false,
}: {
  document: Data.Document
  workflow: Data.DocumentWorkflow
  availableFiles: Data.File[]
  issues: Data.DocumentIssue[]
  unavailableEvidence?: boolean
  projects: Data.Project[]
}) {
  const workspaceId = useWorkspaceId()
  const { dirtyKeys } = useWorkspace()
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [panel, setPanel] = useState(false)
  const [wide, setWide] = useState(false)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [ack, setAck] = useState<string[]>([])
  const [exportTask, setExportTask] = useState<Task | null>(null)
  const mutation = useRef(new Map<string, { hash: string; id: string }>())
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  useEffect(() => {
    const media = window.matchMedia('(min-width:1280px)')
    const update = () => {
      if (!dirtyKeys.some((key) => ['source-selection', 'issue-form'].includes(key)))
        setWide(media.matches)
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [dirtyKeys])
  const reload = () =>
    router.reload({ only: ['document', 'workflow', 'availableFiles', 'issues', 'recentDocuments'] })
  const action: Action = async (url, method, body) => {
    if (busy) return false
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api(url, method, body)
      if (active.current) {
        reload()
        setNotice('Changes saved.')
      }
      return true
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'The request failed.')
      if (active.current)
        setError(
          reason instanceof Error ? reason.message : 'The request failed. Your input is still here.'
        )
      return false
    } finally {
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
    const body = approve
      ? {
          baseVersionId: document.currentVersionId,
          reviewId: workflow.review?.id,
          warningAcknowledgments: ack,
        }
      : { baseVersionId: document.currentVersionId }
    const route = approve ? 'documentReviews.approve' : 'documentReviews.store'
    if (
      await action(
        urlFor(route, { workspaceId, documentId: document.id }),
        'POST',
        intent(route, body)
      )
    ) {
      mutation.current.delete(route)
      setApprovalOpen(false)
    }
  }
  async function generate() {
    if (
      document.currentVersionId &&
      !window.confirm(
        'Generate a new draft from the current writing inputs and selected evidence? Your saved versions remain in the version history.'
      )
    )
      return
    if (
      await action(
        urlFor('documentTasks.generate', { workspaceId, documentId: document.id }),
        'POST',
        intent('generate', { baseVersionId: document.currentVersionId })
      )
    )
      mutation.current.delete('generate')
  }
  async function exportPdf() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await api<{ data: Task }>(
        urlFor('exportPdfs.store', { workspaceId, documentId: document.id }),
        'POST',
        intent('export', { approvalId: workflow.approval?.id })
      )
      if (active.current) setExportTask(result.data)
    } catch (reason) {
      if (active.current)
        setError(reason instanceof Error ? reason.message : 'The PDF request failed.')
    } finally {
      if (active.current) setBusy(false)
    }
  }
  useEffect(() => {
    if (!exportTask || !['queued', 'running'].includes(exportTask.status)) return
    const controller = new AbortController()
    let polling = false
    const poll = async () => {
      if (polling || window.document.visibilityState === 'hidden') return
      polling = true
      try {
        const result = await api<{ data: Task }>(
          urlFor('documentTasks.show', { workspaceId, taskId: exportTask.id }),
          'GET',
          undefined,
          controller.signal
        )
        if (!controller.signal.aborted) setExportTask(result.data)
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Unable to refresh PDF status.')
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
  }, [exportTask, workspaceId])
  const processing = ['queued', 'processing', 'running'].includes(document.generationStatus ?? '')
  useEffect(() => {
    if (!processing) return
    const interval = setInterval(() => {
      if (window.document.visibilityState === 'visible') reload()
    }, 2500)
    return () => clearInterval(interval)
  }, [processing])
  const disabled = busy || dirty || processing
  const version =
    document.documentVersions?.find((item) => item.id === document.currentVersionId) ??
    document.documentVersions?.[0]
  const onDirty = useCallback((value: boolean) => setDirty(value), [])
  const inspector = (
    <DocumentInspector
      key={document.id}
      document={document}
      workflow={workflow}
      availableFiles={availableFiles}
      issues={issues}
      action={action}
      disabled={disabled}
    />
  )
  return (
    <div className="min-w-0">
      <Head title={document.title} />
      <header className="border-b bg-sidebar px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            route="documents.index"
            routeParams={{ workspaceId }}
            aria-label="Back to case studies"
            className="rounded-lg border p-2"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">
              Case study / {(document.status ?? 'draft').replaceAll('_', ' ')}
            </p>
            <h1 className="mt-1 truncate text-sm font-semibold" title={document.title}>
              {document.title}
            </h1>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link
              href={`${urlFor('documents.create', { workspaceId })}${document.projectId ? `?projectId=${document.projectId}` : ''}`}
            >
              <Plus className="size-3.5" />
              New case study
            </Link>
          </Button>
          <StatusBadge status={document.status} />
          {!wide && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Open document inspector"
              onClick={() => setPanel(true)}
            >
              <SlidersHorizontal />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={
              disabled ||
              !workflow.readiness.canSubmit ||
              !!(workflow.review && !workflow.review.invalidatedAt)
            }
            onClick={() => void review()}
          >
            Submit for review
          </Button>
          {document.capabilities.approve &&
            workflow.review &&
            !workflow.review.invalidatedAt &&
            !workflow.readiness.approved && (
              <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={disabled}>
                    <Check />
                    Approve version
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Approve this saved version?</DialogTitle>
                    <DialogDescription>
                      Only this exact version and its current source state will be approved. Later
                      content changes invalidate this approval.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {workflow.readiness.warnings.map((warning) => (
                      <label
                        key={warning.id}
                        className="flex items-start gap-3 rounded-lg border p-4 text-sm"
                      >
                        <Checkbox
                          checked={ack.includes(warning.id)}
                          onCheckedChange={(value) =>
                            setAck((current) =>
                              value
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
                        workflow.readiness.warnings.some((warning) => !ack.includes(warning.id))
                      }
                      onClick={() => void review(true)}
                    >
                      Approve saved version {version?.version}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <VersionHistory versions={document.documentVersions ?? []} />
          <MetadataForm
            document={document}
            projects={projects}
            action={action}
            disabled={disabled}
          />
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => void generate()}>
            <Sparkles />
            Generate draft
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild disabled={dirty || !version}>
              {version && !dirty ? (
                <a
                  href={urlFor('exportPdfs.preview', { workspaceId, documentId: document.id })}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview PDF
                </a>
              ) : (
                <span>Preview PDF</span>
              )}
            </Button>
            <Button
              variant={workflow.readiness.approved ? 'default' : 'outline'}
              size="sm"
              disabled={
                disabled ||
                !workflow.readiness.approved ||
                exportTask?.status === 'running' ||
                exportTask?.status === 'queued'
              }
              onClick={() => void exportPdf()}
            >
              <Download />
              Final PDF
            </Button>
          </div>
        </div>
        {dirty && (
          <p className="mt-3 text-xs text-muted-foreground">
            Save your content before changing project information, reviewing, generating, or
            exporting.
          </p>
        )}
      </header>
      {error && (
        <div
          role="alert"
          className="border-b border-destructive/30 bg-sidebar px-5 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="sr-only">
          {notice}
        </p>
      )}
      {exportTask && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 border-b bg-sidebar p-4 text-xs"
        >
          {['queued', 'running'].includes(exportTask.status) ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Preparing approved PDF…
            </>
          ) : exportTask.status === 'succeeded' && exportTask.result?.downloadUrl ? (
            <>
              <Check className="size-4" />
              Approved PDF is ready.
              <Button size="sm" asChild>
                <a href={exportTask.result.downloadUrl}>Download PDF</a>
              </Button>
            </>
          ) : (
            <span className="text-destructive">
              {exportTask.error ||
                'This export is no longer current. Request a new PDF after approval.'}
            </span>
          )}
        </div>
      )}
      {unavailableEvidence && (
        <p role="status" className="border-b bg-primary/10 px-5 py-3 text-xs leading-relaxed">
          Some evidence in the saved history is unavailable or cannot be verified. Those citations
          and images are hidden. Inspect the source library before submitting another review.
        </p>
      )}
      {processing && (
        <div
          role="status"
          className="flex items-center gap-2 border-b bg-sidebar px-5 py-3 text-xs"
        >
          <LoaderCircle className="size-4 animate-spin" />
          Preparing an AI draft. Saved content remains available below.
        </div>
      )}
      {document.generationStatus === 'failed' && (
        <p role="alert" className="border-b p-4 text-xs text-destructive">
          {document.generationError || 'Draft generation failed. Your saved content is preserved.'}
        </p>
      )}
      <div className="flex min-w-0 items-start">
        <DocumentEditor
          documentId={document.id}
          baseVersionId={document.currentVersionId}
          initialContent={version?.content ?? null}
          onDirtyChange={onDirty}
        />
        {wide ? (
          <aside
            aria-label="Document inspector"
            className="sticky top-0 max-h-dvh w-72 shrink-0 overflow-y-auto border-l bg-sidebar"
          >
            {inspector}
          </aside>
        ) : (
          <Sheet
            open={panel}
            onOpenChange={(value) => {
              if (
                !value &&
                dirtyKeys.some((key) => ['source-selection', 'issue-form'].includes(key)) &&
                !window.confirm('Discard unsaved inspector changes?')
              )
                return
              setPanel(value)
            }}
          >
            <SheetContent className="w-[min(100vw,22rem)] gap-0 overflow-y-auto p-0">
              <SheetHeader className="border-b p-5">
                <SheetTitle>Document inspector</SheetTitle>
                <SheetDescription>Properties, readiness, evidence, and issues.</SheetDescription>
              </SheetHeader>
              {inspector}
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  )
}
