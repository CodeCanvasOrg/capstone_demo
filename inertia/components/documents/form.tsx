import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useForm } from '@inertiajs/react'
import type { Data } from '@generated/data'
import { FolderOpen, LoaderCircle, Sparkles, Undo2, Wand2 } from 'lucide-react'
import { urlFor } from '@/client'
import { api, feedbackError } from '@/lib/api'
import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { TemplatePreview } from '@/components/documents/template_preview'
import { DEFAULT_INSTRUCTIONS, MAX_INSTRUCTIONS } from '../../../shared/templates/instructions.ts'
import { Disclosure } from '@/components/disclosure'
import { PortfolioOptions } from '@/components/canvas/portfolio_options'
import { TemplateGallery, useTemplates } from '@/components/canvas/template_gallery'
import type { GenerationOptions } from '@/components/canvas/generation'
import { templateSelection } from '../../../shared/brochure/designs.ts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SourcePicker, selectable, type SourceChoice } from '@/components/files/source_picker'
import {
  RichTextEditor,
  emptyRichText,
  textToRichText,
  type RichText,
} from '@/components/rich_text_editor'

const FREEFORM = 'freeform'
const BROCHURE = 'brochure'

/**
 * How the case study is laid out. "Use a template" is the Navy and gold portfolio (a cover,
 * then an entry and a sources page for each project), "Let AI choose" has the model design
 * every page, and both open in the canvas. `plain` is a text document with no page designs,
 * edited in the text editor. With canvas generation off the first two are written as the
 * older brochure instead, and the hints say so.
 */
type Mode = 'template' | 'ai' | 'plain'
const modes = (canvasGeneration: boolean): readonly { id: Mode; label: string; hint: string }[] => [
  {
    id: 'template',
    label: 'Use a template',
    hint: canvasGeneration ? 'The Navy and gold portfolio' : 'A ready-made brochure',
  },
  {
    id: 'ai',
    label: 'Let AI choose',
    hint: canvasGeneration
      ? 'AI designs every page from your materials'
      : 'It picks the designs that fit',
  },
  { id: 'plain', label: 'Plain text document', hint: 'Just text, no page designs' },
]

/** What the portfolio options start as, and what the form sends for each mode. */
type Choices = Pick<GenerationOptions, 'entries' | 'depth' | 'images'>
const DEFAULT_CHOICES: Choices = { entries: 'auto', depth: 'standard', images: true }

type BriefResult = {
  data: {
    brief: string
    mode: 'all' | 'retrieved'
    passages: number
    sources: { fileName: string; passages: number }[]
  }
}
type BriefState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'done'; note: string; previous: { composer: RichText; text: string } }
  | { status: 'error'; message: string }

function StepLabel({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background tabular-nums">
        {n}
      </span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

export function DocumentForm({
  files = [],
  projects = [],
  initialProjectId = null,
  canvasGeneration = false,
}: {
  files?: Data.File[]
  projects?: Data.Project[]
  initialProjectId?: string | null
  /** Canvas page generation is on: template and AI case studies open in the canvas. */
  canvasGeneration?: boolean
}) {
  const workspaceId = useWorkspaceId()
  const { templates } = useTemplates(workspaceId, null, canvasGeneration)
  const [composer, setComposer] = useState<RichText>(emptyRichText)
  const [text, setText] = useState('')
  const [instructions, setInstructions] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const [uploads, setUploads] = useState<SourceChoice[]>([])
  const [droppedSources, setDroppedSources] = useState(0)
  const [briefState, setBriefState] = useState<BriefState>({ status: 'idle' })
  const briefRequest = useRef<AbortController | null>(null)
  useEffect(() => () => briefRequest.current?.abort(), [])
  const projectHasFiles =
    !!projectId && files.some((file) => file.projects?.some((project) => project.id === projectId))
  const canWriteBrief = selected.length > 0 || projectHasFiles
  async function writeBrief() {
    if (!canWriteBrief || briefState.status === 'pending') return
    briefRequest.current?.abort()
    const controller = new AbortController()
    briefRequest.current = controller
    const previous = { composer, text }
    setBriefState({ status: 'pending' })
    try {
      const result = await api<BriefResult>(
        urlFor('briefs.store', { workspaceId }),
        'POST',
        { projectId: projectId || null, fileIds: selected, draft: text.trim() || null },
        controller.signal
      )
      const { brief, passages, sources, mode } = result.data
      setComposer(textToRichText(brief))
      setText(brief)
      const fileCount = `${sources.length} ${sources.length === 1 ? 'file' : 'files'}`
      setBriefState({
        status: 'done',
        previous,
        note:
          mode === 'all'
            ? `Written from all ${passages} passages in ${fileCount}.`
            : `Written from the ${passages} most relevant passages in ${fileCount}.`,
      })
    } catch (reason) {
      if (controller.signal.aborted) return
      setBriefState({
        status: 'error',
        message: feedbackError(reason, 'The brief could not be written. Try again.').message,
      })
    }
  }
  function undoBrief() {
    if (briefState.status !== 'done') return
    setComposer(briefState.previous.composer)
    setText(briefState.previous.text)
    setBriefState({ status: 'idle' })
  }
  const [mode, setMode] = useState<Mode>('template')
  const [choices, setChoices] = useState<Choices>(DEFAULT_CHOICES)
  function changeProject(next: string) {
    const options = new Map([...files, ...uploads].map((file) => [file.id, file]))
    const kept = selected.filter((id) => {
      const file = options.get(id)
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
    instructions: '' as string | null,
    projectId: null as string | null,
    sourceMode: 'input_only' as 'files' | 'input_only',
    projectInformation: { overview: '' },
    files: [] as { id: string }[],
  })
  useUnsavedChanges(
    'new-case-study',
    !form.processing && (!!text.trim() || !!instructions.trim() || selected.length > 0)
  )
  const ready = !!text.trim() && text.length <= 20000 && instructions.length <= MAX_INSTRUCTIONS
  // A plain document sends no template: the brief alone shapes the text.
  function generate() {
    if (form.processing || !ready) return
    form.transform(() => ({
      templateId: mode === 'plain' ? null : BROCHURE,
      // The canvas pipeline's options. The server uses the brochure below instead when canvas
      // generation is off (absent there means the model chooses every page).
      ...(mode === 'plain'
        ? {}
        : {
            canvas: { templateSet: mode === 'ai' ? 'ai_design' : 'portfolio', ...choices },
            ...(mode === 'template' ? { brochure: templateSelection(BROCHURE)! } : {}),
          }),
      description: text,
      descriptionContent: composer,
      // Empty instructions are replaced with the defaults on the server.
      instructions: instructions.trim() || null,
      projectId: projectId || null,
      sourceMode: selected.length ? 'files' : 'input_only',
      projectInformation: { overview: text },
      files: selected.map((id) => ({ id })),
    }))
    form.post(urlFor('documents.store', { workspaceId }))
  }
  const handled = [
    'description',
    'descriptionContent',
    'projectInformation',
    'projectId',
    'instructions',
  ]
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-x-10 gap-y-10 px-5 py-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:py-14">
        <div className="min-w-0">
          <div className="step-in mb-8" style={{ '--i': 0 } as CSSProperties}>
            <h1 className="page-title text-2xl sm:text-3xl">New case study</h1>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Tell us what you worked on, pick a look, and we&rsquo;ll write the first draft.
            </p>
          </div>

          <section
            className="step-in"
            style={{ '--i': 1 } as CSSProperties}
            data-tour="create-brief"
          >
            <StepLabel n={1} title="The brief" />
            <div className="rounded-2xl border bg-sidebar p-4 shadow-xs">
              <RichTextEditor
                value={composer}
                onChange={(value, plain) => {
                  setComposer(value)
                  setText(plain)
                  // Typing over the generated brief makes it yours; undo would discard that.
                  if (briefState.status !== 'pending') setBriefState({ status: 'idle' })
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
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div data-tour="create-sources">
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
                  variant="outline"
                  size="sm"
                  onClick={writeBrief}
                  disabled={form.processing || !canWriteBrief || briefState.status === 'pending'}
                  title={
                    canWriteBrief
                      ? 'Write a short brief from your sources'
                      : 'Add sources or choose a project with files first'
                  }
                  data-tour="create-brief-ai"
                >
                  {briefState.status === 'pending' ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Sparkles aria-hidden="true" />
                  )}
                  {briefState.status === 'pending' ? 'Reading sources…' : 'Generate with AI'}
                </Button>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {selected.length
                    ? `${selected.length} ${selected.length === 1 ? 'source' : 'sources'}`
                    : 'Brief only'}
                </span>
              </div>
            </div>
            {briefState.status === 'done' && (
              <p
                role="status"
                className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="min-w-0">{briefState.note}</span>
                <button
                  type="button"
                  onClick={undoBrief}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-foreground underline-offset-4 hover:underline"
                >
                  <Undo2 aria-hidden="true" className="size-3.5" />
                  Undo
                </button>
              </p>
            )}
            {briefState.status === 'error' && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {briefState.message}
              </p>
            )}
            {text.length > 20000 && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                Keep the brief under 20,000 characters.
              </p>
            )}
          </section>

          <section
            className="step-in mt-8"
            style={{ '--i': 2 } as CSSProperties}
            data-tour="create-instructions"
          >
            <StepLabel n={2} title="Instructions" hint="Optional" />
            <Textarea
              aria-label="Generation instructions"
              aria-invalid={!!form.errors.instructions || instructions.length > MAX_INSTRUCTIONS}
              value={instructions}
              maxLength={MAX_INSTRUCTIONS + 200}
              onChange={(event) => setInstructions(event.target.value)}
              disabled={form.processing}
              placeholder="How should it read? e.g. keep it under 300 words, friendly tone, lead with the cost savings."
              className="min-h-28 border-border bg-sidebar"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <details className="group/defaults min-w-0">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 select-none [&::-webkit-details-marker]:hidden">
                  <Wand2 aria-hidden="true" className="size-3.5" />
                  {instructions.trim()
                    ? 'Your instructions will be used'
                    : 'Empty? We use sensible defaults'}
                </summary>
                <div className="mt-2 rounded-xl border bg-muted/40 p-3 leading-5 whitespace-pre-line">
                  {DEFAULT_INSTRUCTIONS}
                </div>
              </details>
              {!instructions.trim() && (
                <button
                  type="button"
                  onClick={() => setInstructions(DEFAULT_INSTRUCTIONS)}
                  disabled={form.processing}
                  className="rounded-md px-1.5 py-1 font-medium text-foreground underline-offset-4 transition-transform duration-150 ease-[var(--ease-out)] hover:underline active:scale-[.97]"
                >
                  Edit the defaults
                </button>
              )}
            </div>
            {form.errors.instructions && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {form.errors.instructions}
              </p>
            )}
          </section>

          {projects.length > 0 && (
            <div
              className="step-in mt-6 -mx-5"
              style={{ '--i': 3 } as CSSProperties}
              data-tour="create-project"
            >
              <Disclosure
                title="Project"
                icon={FolderOpen}
                summary={projects.find((project) => project.id === projectId)?.name ?? 'Optional'}
                reveal={!!form.errors.projectId}
              >
                <label className="inline-flex max-w-48 items-center gap-1 px-5 text-xs text-muted-foreground">
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
                  <p
                    id="brief-project-error"
                    role="alert"
                    className="px-5 text-xs text-destructive"
                  >
                    {form.errors.projectId}
                  </p>
                )}
                {droppedSources > 0 && (
                  <p role="status" className="px-5 text-xs text-muted-foreground">
                    {droppedSources === 1
                      ? '1 source from the previous project was removed.'
                      : `${droppedSources} sources from the previous project were removed.`}
                  </p>
                )}
              </Disclosure>
            </div>
          )}
        </div>

        <section
          className="step-in min-w-0"
          style={{ '--i': 2 } as CSSProperties}
          aria-labelledby="template-heading"
          aria-busy={form.processing}
          data-tour="create-layout"
        >
          <div id="template-heading">
            <StepLabel n={3} title="Layout" />
          </div>
          <div
            role="radiogroup"
            aria-label="How to lay out this case study"
            className="mb-4 grid gap-2 sm:grid-cols-3"
          >
            {modes(canvasGeneration).map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer flex-col gap-0.5 rounded-xl border bg-card px-3 py-2.5 has-[:checked]:border-foreground/70 has-[:checked]:shadow-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40"
              >
                <input
                  type="radio"
                  name="layout-mode"
                  value={item.id}
                  checked={mode === item.id}
                  onChange={() => setMode(item.id)}
                  disabled={form.processing}
                  className="sr-only"
                />
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.hint}</span>
              </label>
            ))}
          </div>
          {(mode === 'template' || mode === 'ai') && (
            <div
              className="step-in flex flex-col gap-5"
              style={{ '--i': 0 } as CSSProperties}
              data-testid="portfolio-layout"
            >
              {mode === 'template' ? (
                <TemplateGallery templates={templates} />
              ) : (
                <p className="max-w-prose rounded-xl border bg-card p-4 text-sm leading-6">
                  The AI reads your brief and sources, then designs every page of the portfolio and
                  writes it. You can see and change its choices in the canvas afterwards.
                </p>
              )}
              <PortfolioOptions
                value={choices}
                onChange={(next) => setChoices((current) => ({ ...current, ...next }))}
                imageCount={null}
                disabled={form.processing}
                idPrefix="create"
              />
              {!canvasGeneration && (
                <p role="note" className="text-xs text-muted-foreground">
                  Canvas page generation is off in this workspace, so this is written as a{' '}
                  {mode === 'template' ? 'brochure with the default template' : 'brochure'} instead,
                  and these choices are not used.
                </p>
              )}
            </div>
          )}
          {mode === 'plain' && (
            <div
              className="step-in grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]"
              style={{ '--i': 0 } as CSSProperties}
            >
              <div className="max-w-prose rounded-xl border bg-card p-4 text-sm leading-6">
                <p>
                  A document of headings, paragraphs and lists, with citations to your sources. The
                  AI writes it from your brief, and you edit it in the text editor. It has no page
                  designs and exports as a simple PDF.
                </p>
                <p className="mt-2 text-muted-foreground">
                  For designed pages you can move, resize and restyle, choose one of the other
                  options: they open in the canvas.
                </p>
              </div>
              <div
                className="preview-stage relative h-72 overflow-hidden rounded-2xl border bg-muted/40 shadow-xs"
                role="img"
                aria-label="Preview of a plain text document"
              >
                <TemplatePreview id={FREEFORM} />
              </div>
            </div>
          )}
        </section>
      </div>

      {Object.entries(form.errors).some(([key]) => !handled.includes(key)) && (
        <div className="mx-auto w-full max-w-6xl px-5 pb-3">
          {Object.entries(form.errors)
            .filter(([key]) => !handled.includes(key))
            .map(([key, error]) => (
              <p role="alert" key={key} className="text-xs text-destructive">
                {error}
              </p>
            ))}
        </div>
      )}

      <div className="sticky bottom-0 z-10 border-t bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <p role="status" className="min-w-0 truncate text-xs text-muted-foreground">
            {form.processing
              ? 'Creating your case study…'
              : !text.trim()
                ? 'Add a brief to get started.'
                : `${mode === 'plain' ? 'Plain text document' : mode === 'template' ? 'Navy and gold portfolio' : 'AI designs the pages'} · ${selected.length ? `${selected.length} sources` : 'brief only'} · ${instructions.trim() ? 'your instructions' : 'default instructions'}`}
          </p>
          <Button
            type="button"
            size="lg"
            disabled={form.processing || !ready}
            onClick={generate}
            data-tour="create-generate"
          >
            {form.processing ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            {form.processing ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      </div>
    </div>
  )
}
