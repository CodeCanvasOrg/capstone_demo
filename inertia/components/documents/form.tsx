import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useForm } from '@inertiajs/react'
import type { Data } from '@generated/data'
import { FolderOpen, LoaderCircle, Sparkles, Undo2, Wand2 } from 'lucide-react'
import { urlFor } from '@/client'
import { api, feedbackError } from '@/lib/api'
import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { TemplatePreview, PreviewThumb } from '@/components/documents/template_preview'
import { specFor } from '@/components/documents/template_specs'
import { outlineSections, type OutlineTemplate } from '../../../shared/templates/outlines.ts'
import { DEFAULT_INSTRUCTIONS, MAX_INSTRUCTIONS } from '../../../shared/templates/instructions.ts'
import { Disclosure } from '@/components/disclosure'
import { DesignThumb } from '@/components/brochure/design_thumb'
import { PageDesigner } from '@/components/brochure/page_designer'
import {
  BROCHURE_TEMPLATES,
  templateSelection,
  type BrochureSelection,
} from '../../../shared/brochure/designs.ts'
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
 * How the case study is laid out. The first three build a brochure, where every page has its
 * own design: a full template, a design chosen for each page, or the model's choice. The
 * model writes the content of every page in each of them. `classic` is the older case study.
 */
type Mode = 'template' | 'pages' | 'ai' | 'classic'
const MODES: readonly { id: Mode; label: string; hint: string }[] = [
  { id: 'template', label: 'Use a template', hint: 'A ready-made set of page designs' },
  { id: 'pages', label: 'Choose each page', hint: 'Pick a design for every page' },
  { id: 'ai', label: 'Let AI choose', hint: 'It picks the designs that fit' },
  { id: 'classic', label: 'Classic case study', hint: 'The older one to two page layouts' },
]

type Choice = { id: string; name: string; description: string; headings: string[] }

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

function headingsOf(template: OutlineTemplate) {
  try {
    return outlineSections(template.definition.outline)
      .slice(1)
      .filter((section) => section.level === 2)
      .map((section) => section.heading)
  } catch {
    return []
  }
}

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
  const choices = useMemo<Choice[]>(
    () => [
      ...templates
        .filter((template) => template.id !== BROCHURE)
        .map((template) => ({
          id: template.id,
          name: template.definition.name,
          description: template.definition.description,
          headings: headingsOf(template),
        })),
      {
        id: FREEFORM,
        name: 'Freeform',
        description: 'No fixed structure. The model writes from your brief and sources alone.',
        headings: [],
      },
    ],
    [templates]
  )
  const [templateId, setTemplateId] = useState(choices[0].id)
  const [mode, setMode] = useState<Mode>('template')
  const [selection, setSelection] = useState<BrochureSelection>(() => templateSelection(BROCHURE)!)
  const choice = choices.find((item) => item.id === templateId) ?? choices[0]
  const spec = specFor(choice.id)
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
  const ready =
    !!text.trim() &&
    text.length <= 20000 &&
    instructions.length <= MAX_INSTRUCTIONS &&
    (mode !== 'pages' || selection.pages.length > 0)
  // The freeform choice sends a null template: the brief alone shapes the case study.
  function generate() {
    if (form.processing || !ready) return
    form.transform(() => ({
      templateId: mode === 'classic' ? (choice.id === FREEFORM ? null : choice.id) : BROCHURE,
      // Absent means the model chooses every page.
      ...(mode === 'template' || mode === 'pages' ? { brochure: selection } : {}),
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
            <StepLabel
              n={3}
              title="Layout"
              hint={mode === 'classic' ? 'Pick a template to preview it' : undefined}
            />
          </div>
          <div
            role="radiogroup"
            aria-label="How to lay out this case study"
            className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
          >
            {MODES.map((item) => (
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
          {mode === 'template' && (
            <div
              role="radiogroup"
              aria-label="Brochure template"
              className="step-in grid gap-3 sm:grid-cols-2"
              style={{ '--i': 0 } as CSSProperties}
            >
              {BROCHURE_TEMPLATES.map((template) => (
                <label
                  key={template.id}
                  className="flex cursor-pointer flex-col gap-3 rounded-2xl border bg-card p-3 has-[:checked]:border-foreground/70 has-[:checked]:shadow-md has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40"
                >
                  <input
                    type="radio"
                    name="brochure-template"
                    value={template.id}
                    checked={selection.template === template.id}
                    onChange={() => setSelection(templateSelection(template.id)!)}
                    disabled={form.processing}
                    className="sr-only"
                  />
                  <span className="flex gap-1.5 overflow-hidden" aria-hidden="true">
                    {template.pages.slice(0, 9).map((design, i) => (
                      <DesignThumb key={i} design={design} className="w-[2.6rem] shrink-0" />
                    ))}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{template.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {template.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {mode === 'pages' && (
            <div className="step-in space-y-3" style={{ '--i': 0 } as CSSProperties}>
              <p className="text-xs text-muted-foreground">
                Pick a design for every page. The AI writes the content of each one, and can choose
                the design of any page you leave to it.
              </p>
              <PageDesigner value={selection} onChange={setSelection} disabled={form.processing} />
            </div>
          )}
          {mode === 'ai' && (
            <p
              className="step-in max-w-prose rounded-xl border bg-card p-4 text-sm leading-6"
              style={{ '--i': 0 } as CSSProperties}
            >
              The AI reads your brief and sources, decides how many pages the brochure needs, picks
              the page design that best fits each one, and writes the content. You can see and
              change its choices in the editor afterwards.
            </p>
          )}
          {mode === 'classic' && (
            <>
              {!templates.length && (
                <p role="status" className="mb-3 text-xs text-muted-foreground">
                  Company templates are unavailable. Reload this page to try again, or write
                  freeform.
                </p>
              )}
              <div
                role="radiogroup"
                aria-label="Template"
                className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
              >
                {choices.map((item) => (
                  <label
                    key={item.id}
                    className="template-card group relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border bg-card p-2.5 pb-2 text-center has-[:checked]:border-foreground/70 has-[:checked]:shadow-md has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40"
                  >
                    <input
                      type="radio"
                      name="template"
                      value={item.id}
                      checked={templateId === item.id}
                      onChange={() => setTemplateId(item.id)}
                      disabled={form.processing}
                      className="sr-only"
                    />
                    <span className="template-thumb rounded-[4px]">
                      <PreviewThumb id={item.id} width={78} />
                    </span>
                    <span className="line-clamp-2 text-[11px] leading-4 font-semibold">
                      {item.name}
                    </span>
                  </label>
                ))}
              </div>

              <div
                className="preview-stage relative mt-4 h-[26rem] overflow-hidden rounded-3xl border bg-muted/40 text-foreground shadow-xs sm:h-[30rem]"
                role="img"
                aria-label={`Preview of the ${choice.name} template, ${spec.length}`}
              >
                <TemplatePreview id={choice.id} />
              </div>

              <div key={choice.id} className="step-in mt-4" style={{ '--i': 0 } as CSSProperties}>
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div className="min-w-0 max-w-md">
                    <h3 className="text-base font-semibold tracking-tight">{choice.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {choice.description}
                    </p>
                  </div>
                  <dl className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div>
                      <dt className="sr-only">Colors</dt>
                      <dd className="flex -space-x-1.5">
                        {[
                          spec.palette.primary,
                          spec.palette.accent,
                          spec.palette.surface,
                          spec.palette.bg,
                        ].map((color, i) => (
                          <span
                            key={i}
                            title={color}
                            className="size-5 rounded-full ring-2 ring-background"
                            style={{
                              background: color,
                              boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / .12)',
                            }}
                          />
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">{spec.fontName}</dt>
                      <dd>{spec.length}</dd>
                    </div>
                  </dl>
                </div>
                {choice.headings.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Sections it writes">
                    {choice.headings.map((heading) => (
                      <li
                        key={heading}
                        className="rounded-full border bg-card px-2.5 py-1 text-[11px] leading-none text-muted-foreground"
                      >
                        {heading}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
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
                : `${mode === 'classic' ? choice.name : mode === 'template' ? (BROCHURE_TEMPLATES.find((t) => t.id === selection.template)?.label ?? 'Brochure') : mode === 'pages' ? `${selection.pages.length} pages` : 'AI chooses'} · ${selected.length ? `${selected.length} sources` : 'brief only'} · ${instructions.trim() ? 'your instructions' : 'default instructions'}`}
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
