import { useEffect, useRef, useState } from 'react'
import { useForm } from '@inertiajs/react'
import type { Data } from '@generated/data'
import {
  ArrowUp,
  ArrowRight,
  Check,
  FolderOpen,
  MessageSquare,
  Pencil,
  Sparkles,
} from 'lucide-react'
import { urlFor } from '@/client'
import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { SourcePicker } from '@/components/files/source_picker'
import {
  RichTextEditor,
  emptyRichText,
  textToRichText,
  type RichText,
} from '@/components/rich_text_editor'
import type { ProjectInformation } from './project_fields'
const questions = [
  {
    key: 'overview',
    question: 'What would you like to write about?',
    hint: 'Describe the project, the work, or the story you want to tell…',
  },
  {
    key: 'problemStatement',
    question: 'What problem were you trying to solve?',
    hint: 'Tell me what needed to change…',
  },
  {
    key: 'workCompleted',
    question: 'What did you build or deliver?',
    hint: 'Describe the work your team completed…',
  },
  {
    key: 'technicalApproach',
    question: 'How did you approach the work?',
    hint: 'Walk through the approach and key decisions…',
  },
  {
    key: 'tools',
    question: 'Which tools and technologies did you use?',
    hint: 'Mention the tools that made it possible…',
  },
  {
    key: 'challenges',
    question: 'What challenges did you work through?',
    hint: 'What was difficult, and how did you handle it?',
  },
  {
    key: 'results',
    question: 'What changed as a result?',
    hint: 'Share outcomes, impact, or what you learned…',
  },
] as const
type Answer = { text: string; content: RichText }
export function DocumentForm({
  files = [],
  projects = [],
  initialProjectId = null,
}: {
  files?: Data.File[]
  projects?: Data.Project[]
  initialProjectId?: string | null
}) {
  const workspaceId = useWorkspaceId()
  const [answers, setAnswers] = useState<Partial<Record<keyof ProjectInformation, Answer>>>({})
  const [step, setStep] = useState(0)
  const [composer, setComposer] = useState<RichText>(emptyRichText)
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const [inputOnly, setInputOnly] = useState(false)
  const [title, setTitle] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const form = useForm({
    title: '',
    description: '',
    descriptionContent: emptyRichText(),
    projectId: '',
    sourceMode: 'files' as 'files' | 'input_only',
    projectInformation: {} as ProjectInformation,
    files: [] as { id: string }[],
  })
  const started = !!answers.overview
  const question = questions[Math.min(step, questions.length - 1)]
  useUnsavedChanges('new-case-study', started || !!text.trim() || selected.length > 0)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [step])
  function answer() {
    if (!text.trim() || text.length > 20000 || step >= questions.length) return
    setAnswers((current) => ({ ...current, [question.key]: { text, content: composer } }))
    if (!started) setTitle(text.trim().split('\n')[0].slice(0, 100))
    setComposer(emptyRichText())
    setText('')
    setStep(step + 1)
  }
  function create() {
    const values = { ...answers }
    if (text.trim() && step < questions.length) values[question.key] = { text, content: composer }
    const brief = values.overview
    if (!brief) return
    form.transform(() => ({
      title: title.trim() || brief.text.trim().split('\n')[0].slice(0, 100),
      description: brief.text,
      descriptionContent: brief.content,
      projectId: projectId || null,
      sourceMode: inputOnly ? 'input_only' : 'files',
      projectInformation: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value!.text])
      ),
      files: inputOnly ? [] : selected.map((id) => ({ id })),
    }))
    form.post(urlFor('documents.store', { workspaceId }))
  }
  function edit(index: number) {
    const value = answers[questions[index].key]
    setStep(index)
    setComposer(value?.content ?? emptyRichText())
    setText(value?.text ?? '')
  }
  return (
    <div
      className={`mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 ${started ? 'pt-10 pb-8' : 'justify-center py-16'}`}
    >
      {!started ? (
        <div className="mb-8">
          <div className="mb-5 flex size-9 items-center justify-center rounded-xl border text-muted-foreground">
            <MessageSquare className="size-4" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            What story are we telling?
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Start with an idea. Add the evidence. We’ll shape the details together.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-8 flex items-center gap-3">
            <label htmlFor="chat-draft-title" className="sr-only">
              Case-study title
            </label>
            <input
              id="chat-draft-title"
              className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-tight outline-none"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
            />
            <Button variant="ghost" size="sm" onClick={create} disabled={form.processing}>
              Open draft
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
          <div className="space-y-8 pb-8" role="log" aria-label="Case-study setup conversation">
            {questions.map((item, index) =>
              answers[item.key] ? (
                <div key={item.key} className="space-y-3">
                  <p className="text-sm font-medium">{item.question}</p>
                  <div className="group flex items-start gap-2 rounded-xl bg-muted/50 px-4 py-3">
                    <RichTextEditor
                      value={answers[item.key]!.content}
                      label={`Your answer: ${item.key}`}
                      readOnly
                      compact
                      className="min-w-0 flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Edit ${item.key} answer`}
                      onClick={() => edit(index)}
                      disabled={form.processing}
                    >
                      <Pencil className="size-3" />
                    </Button>
                  </div>
                </div>
              ) : null
            )}
            <p aria-live="polite" className="text-sm leading-6">
              {step < questions.length
                ? question.question
                : 'Your brief is ready. Open the draft to write, generate with your sources, or keep refining.'}
            </p>
            <div ref={end} />
          </div>
        </>
      )}
      <div className="rounded-2xl border bg-sidebar p-4 shadow-xs focus-within:border-foreground/30">
        {step < questions.length && (
          <RichTextEditor
            value={composer}
            onSubmit={answer}
            onChange={(value, plain) => {
              setComposer(value)
              setText(plain)
            }}
            label={question.question}
            placeholder={question.hint}
            compact
            disabled={form.processing}
          />
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <SourcePicker
              files={files}
              selected={selected}
              onChange={(ids) => {
                setSelected(ids)
                if (ids.length) setInputOnly(false)
              }}
              disabled={form.processing}
            />
            <label className="inline-flex max-w-48 items-center gap-1 text-xs text-muted-foreground">
              <FolderOpen className="size-3.5 shrink-0" />
              <span className="sr-only">Project</span>
              <select
                aria-label="Project"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
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
          </div>
          <Button
            type="button"
            size="icon-sm"
            aria-label={
              step >= questions.length
                ? 'Open draft'
                : started
                  ? 'Send answer'
                  : 'Start conversation'
            }
            onClick={step >= questions.length ? create : answer}
            disabled={
              form.processing || (step < questions.length && (!text.trim() || text.length > 20000))
            }
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <button
          type="button"
          aria-pressed={inputOnly}
          onClick={() => {
            setInputOnly(!inputOnly)
            setSelected([])
          }}
          className="inline-flex items-center gap-1 rounded-md px-1 py-1.5 hover:text-foreground"
          disabled={form.processing}
        >
          {inputOnly && <Check className="size-3" />}
          {inputOnly
            ? 'Writing from project information only'
            : selected.length
              ? `${selected.length} sources attached`
              : 'Use project information only'}
        </button>
        {started && step < questions.length && (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="rounded-md px-1 py-1.5 hover:text-foreground"
            disabled={form.processing}
          >
            Skip for now
            <ArrowRight className="ml-1 inline size-3" />
          </button>
        )}
      </div>
      {text.length > 20000 && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          Keep each answer under 20,000 characters.
        </p>
      )}
      {Object.entries(form.errors).map(([key, error]) => (
        <p role="alert" key={key} className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ))}
      {!started && (
        <div className="mt-8 grid gap-2 sm:grid-cols-3">
          {['A project we delivered', 'A problem we solved', 'Results worth sharing'].map(
            (example, index) => (
              <button
                key={example}
                type="button"
                className="rounded-lg border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-muted/40"
                onClick={() => {
                  const value = [
                    'We built ',
                    'We helped our team solve ',
                    'Our project made a difference by ',
                  ][index]
                  setText(value)
                  setComposer(textToRichText(value))
                }}
              >
                <Sparkles className="mb-3 size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{example}</span>
              </button>
            )
          )}
        </div>
      )}
      {started && (
        <p className="mt-6 text-xs leading-5 text-muted-foreground">
          Guided setup · Open a draft whenever you’re ready. Complete the project details before
          submitting for review.
        </p>
      )}
    </div>
  )
}
