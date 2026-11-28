import { Head, router } from '@inertiajs/react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Eye,
  LayoutTemplate,
  LoaderCircle,
  Save,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Link } from '@adonisjs/inertia/react'
import { urlFor } from '@/client'
import { api, ApiError, feedbackError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { EditorModeSwitch } from '@/components/canvas/editor_mode_switch'
import { CanvasToolbar } from '@/components/canvas/canvas_toolbar'
import { Inspector } from '@/components/canvas/inspector'
import { GenerateDialog } from '@/components/canvas/generate_dialog'
import {
  isActive,
  useGenerationRun,
  type GenerationOptions,
  type Run,
} from '@/components/canvas/generation'
import { GenerationProgress } from '@/components/canvas/generation_progress'
import { PageStrip, type PageAction } from '@/components/canvas/page_strip'
import { TextToolbar } from '@/components/canvas/text_toolbar'
import { useCanvasEditor, type SaveStatus } from '@/components/canvas/use_canvas_editor'
import type { CanvasDocument } from '../../../shared/canvas/model.ts'
import type { BrandKit } from '../../../shared/layout/brand.ts'

type Props = {
  document: { id: string; title: string }
  workspaceId: string
  state: {
    mode: 'flow' | 'canvas'
    /** A canvas the server has already validated (typed loosely: page props are plain JSON). */
    project: Record<string, any> | null
    source: 'draft' | 'version' | 'composed' | null
    revision: number
    baseVersionId: string | null
  }
  brand: { palette: BrandKit['palette']; fonts: string[] } | null
  /** Portfolio page generation: off, or the last options, the picture count and the latest run. */
  generation:
    | { enabled: false }
    | { enabled: true; options: GenerationOptions; images: number; run: Run | null }
}

const FALLBACK_PALETTE: BrandKit['palette'] = {
  primary: '#111111',
  accent: '#ffb902',
  accentText: '#946500',
  text: '#111111',
  muted: '#6b7280',
  background: '#ffffff',
  surface: '#f2f0e9',
}

const STATUS: Record<SaveStatus, string> = {
  saved: 'All changes saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  conflict: 'Changed elsewhere',
  error: 'Not saved',
}

/** Opens a document in the canvas the first time: its pages are laid out by their designs. */
function OpenCanvas({ document, workspaceId }: Pick<Props, 'document' | 'workspaceId'>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = async () => {
    setBusy(true)
    setError(null)
    try {
      await api(
        urlFor('documentCanvases.enable', { workspaceId, documentId: document.id }),
        'POST',
        {
          mutationId: crypto.randomUUID(),
        }
      )
      router.reload()
    } catch (err) {
      setError(feedbackError(err).message)
      setBusy(false)
    }
  }
  return (
    <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <LayoutTemplate aria-hidden="true" className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Lay out “{document.title}” freely</h1>
      <p className="text-sm text-muted-foreground">
        Each page opens as an A4 sheet laid out from its design. Move, resize and add boxes; the
        text keeps its citations. Opening saves a new version, so an approved case study needs
        review again.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link route="documents.edit" routeParams={{ workspaceId, id: document.id }}>
            Cancel
          </Link>
        </Button>
        <Button onClick={open} disabled={busy}>
          {busy && <LoaderCircle aria-hidden="true" className="animate-spin" />} Open in canvas
        </Button>
      </div>
    </main>
  )
}

function Editor({
  document,
  workspaceId,
  state,
  brand,
  generation,
}: Props & { state: { project: CanvasDocument } }) {
  const palette = brand?.palette ?? FALLBACK_PALETTE
  const { setContainer, ...canvas } = useCanvasEditor({
    workspaceId,
    documentId: document.id,
    canvas: state.project,
    revision: state.revision,
    baseVersionId: state.baseVersionId,
    brand: { palette, fonts: brand?.fonts ?? [] },
  })
  const [saved, setSaved] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = canvas.status === 'saving'

  // Page generation: the dialog, the run being followed and what the pages are worth.
  const [dialog, setDialog] = useState(false)
  const [announce, setAnnounce] = useState(false)
  const params = { workspaceId, documentId: document.id }
  const generating = useGenerationRun(params, generation.enabled ? generation.run : null)
  const run = generating.run
  // An autosaved draft is still not a version: generating or regenerating replaces it.
  const [edited, setEdited] = useState(state.source === 'draft')
  const [lastStatus, setLastStatus] = useState(canvas.status)
  if (canvas.status !== lastStatus) {
    setLastStatus(canvas.status)
    if (canvas.status === 'unsaved' || canvas.status === 'saving') setEdited(true)
  }
  const unsavedEdits = canvas.status !== 'saved' || edited

  const save = async () => {
    const result = await canvas.saveVersion()
    if (result) {
      setSaved(result.version)
      setEdited(false)
    }
  }

  const started = () => {
    setAnnounce(true)
    generating.watch()
  }
  const generated =
    run?.status === 'ready' && run.pages.length === canvas.sheetIds.length ? run.pages : null
  const blocked = unsavedEdits
    ? 'Save your changes first'
    : isActive(run)
      ? 'Pages are being generated'
      : null
  const pageAction = async (index: number, mode: PageAction) => {
    try {
      await api(urlFor('canvasGenerations.regenerate', { ...params, index }), 'POST', {
        mutationId: crypto.randomUUID(),
        baseVersionId: canvas.baseVersion(),
        mode,
      })
      started()
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 409
          ? 'This page cannot be regenerated now. Reload the canvas and try again.'
          : feedbackError(err).message
      )
    }
  }
  const previewUrl = urlFor('documentPreview.show', { workspaceId, documentId: document.id })
  /**
   * The preview draws the autosaved draft, so pending changes (a box just deleted)
   * are saved first. The tab opens straight away so the browser does not block it.
   */
  const preview = async () => {
    const tab = window.open('about:blank', '_blank')
    await canvas.flush()
    if (tab) tab.location.href = previewUrl
    else window.open(previewUrl, '_blank', 'noreferrer')
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <Button asChild variant="ghost" size="sm">
          <Link route="documents.edit" routeParams={{ workspaceId, id: document.id }}>
            <ArrowLeft aria-hidden="true" /> Case study
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{document.title}</h1>
        <EditorModeSwitch
          workspaceId={workspaceId}
          documentId={document.id}
          mode="canvas"
          current="canvas"
          disabledReason={busy ? 'Wait for the save to finish' : null}
          onError={setError}
        />
        {canvas.uploading > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            {canvas.uploading === 1 ? 'Uploading image…' : `Uploading ${canvas.uploading} images…`}
          </span>
        )}
        {canvas.overflow.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-destructive" role="status">
            <AlertTriangle aria-hidden="true" className="size-3.5" />
            {canvas.overflow.length === 1
              ? 'Text runs past 1 box'
              : `Text runs past ${canvas.overflow.length} boxes`}
          </span>
        )}
        <span
          className={`text-xs ${canvas.status === 'conflict' || canvas.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
          role="status"
          aria-live="polite"
        >
          {saved && canvas.status === 'saved' ? (
            <span className="flex items-center gap-1">
              <Check aria-hidden="true" className="size-3.5" /> Saved as version {saved}
            </span>
          ) : (
            STATUS[canvas.status]
          )}
        </span>
        {generation.enabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialog(true)}
            disabled={isActive(run)}
            data-testid="generate-pages"
          >
            <Sparkles aria-hidden="true" /> Generate pages
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault()
              void preview()
            }}
          >
            <Eye aria-hidden="true" /> Preview
          </a>
        </Button>
        <Button
          size="sm"
          onClick={save}
          disabled={
            busy || canvas.uploading > 0 || canvas.status === 'conflict' || !canvas.canvasEditor
          }
        >
          {busy ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <Save aria-hidden="true" />
          )}
          Save version
        </Button>
      </header>

      {generation.enabled && (
        <GenerationProgress
          run={run}
          announce={announce}
          onRetry={() => setDialog(true)}
          onShow={() => window.location.reload()}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-1.5">
        <CanvasToolbar canvasEditor={canvas.canvasEditor} hasFrame={!!canvas.selected.frame} />
        {canvas.textEditing && (
          <TextToolbar
            editing={canvas.textEditing}
            onDone={() => canvas.canvasEditor?.stopEditing()}
          />
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          <AlertTriangle aria-hidden="true" className="size-4" />
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="ghost" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}
      {canvas.error && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          <AlertTriangle aria-hidden="true" className="size-4" />
          <span className="flex-1">{canvas.error}</span>
          {canvas.status === 'conflict' ? (
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={canvas.dismissError}>
              Dismiss
            </Button>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="overflow-y-auto border-r p-3">
          {generation.enabled && !run && canvas.sheetIds.length <= 2 && (
            <div className="mb-3 flex flex-col gap-2 rounded-lg border border-dashed p-3 text-xs">
              <p className="text-muted-foreground">
                This case study has only a page or two. Write detailed, cited pages from your
                sources.
              </p>
              <Button size="xs" onClick={() => setDialog(true)}>
                <Sparkles aria-hidden="true" /> Generate pages
              </Button>
            </div>
          )}
          <PageStrip
            canvasEditor={canvas.canvasEditor}
            sheetIds={canvas.sheetIds}
            selectedSheetId={canvas.selected.sheetId}
            onChange={canvas.changed}
            generated={generated}
            onAction={pageAction}
            actionsBlocked={blocked}
          />
        </aside>
        <div className="relative min-h-0">
          <div ref={setContainer} className="absolute inset-0" data-testid="canvas" />
          {!canvas.canvasEditor && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> Loading the
              canvas…
            </div>
          )}
        </div>
        <aside className="overflow-y-auto border-l p-4" aria-label="Properties">
          <Inspector
            canvasEditor={canvas.canvasEditor}
            frame={canvas.selected.frame}
            sheetId={canvas.selected.sheetId}
            palette={palette}
            workspaceId={workspaceId}
            documentId={document.id}
          />
          <p className="mt-6 text-xs text-muted-foreground">
            Double-click a text box to edit its text. Press Esc when done. Drop or paste an image
            file on a page to add it.
          </p>
        </aside>
      </div>
      {generation.enabled && (
        <GenerateDialog
          open={dialog}
          onOpenChange={setDialog}
          workspaceId={workspaceId}
          documentId={document.id}
          baseVersionId={canvas.baseVersion}
          initial={generation.options}
          imageCount={generation.images}
          unsaved={unsavedEdits}
          onStarted={started}
        />
      )}
    </div>
  )
}

/** The canvas editor: free layout of a document's pages on A4 sheets. */
export default function CanvasPage(props: Props) {
  const { document, state } = props
  return (
    <>
      <Head title={`${document.title} · Canvas`} />
      {state.mode === 'canvas' && state.project ? (
        <Editor {...props} state={{ ...state, project: state.project as CanvasDocument }} />
      ) : (
        <OpenCanvas document={document} workspaceId={props.workspaceId} />
      )}
    </>
  )
}
