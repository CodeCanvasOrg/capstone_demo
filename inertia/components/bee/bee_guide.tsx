import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { useWorkspace } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Bee, type BeeMood } from './bee'

const STORAGE_KEY = 'codecanvas:bee-tour'
const START_EVENT = 'bee:start-tour'

type Step = {
  title: string
  body: string
  mood: BeeMood
  /** Tried in order; the first visible match is spotlit. No match means a centred message. */
  target?: string[]
}

const STEPS: Step[] = [
  {
    title: 'Hi, I’m Bo.',
    body: 'I’ll show you around in under a minute. Nothing here can break, so poke at anything.',
    mood: 'wave',
  },
  {
    title: 'Your workspace',
    body: 'Everything you make lives in a workspace. Switch teams or start a new one from here.',
    mood: 'idle',
    target: ['[data-tour=workspace]'],
  },
  {
    title: 'Find your way',
    body: 'Case studies, projects, collections and files each get a home. Jump between them any time.',
    mood: 'think',
    target: ['[data-tour=nav]'],
  },
  {
    title: 'Start with a story',
    body: 'A case study begins with a template or a few notes. I’ll help you shape the rest.',
    mood: 'idle',
    target: ['[data-tour=new]', '[data-tour=new-small]'],
  },
  {
    title: 'Make it yours',
    body: 'Switch between light and dark, sign out, or replay this tour with the sparkle button.',
    mood: 'idle',
    target: ['[data-tour=account]'],
  },
  {
    title: 'You’re all set!',
    body: 'Your first case study is one click away. I’ll be right here if you need me.',
    mood: 'cheer',
  },
]

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return 'done'
  }
}
function write() {
  try {
    localStorage.setItem(STORAGE_KEY, 'done')
  } catch {
    /* private mode: the tour simply shows again next visit */
  }
}

export function startBeeTour() {
  window.dispatchEvent(new Event(START_EVENT))
}

export function BeeTourButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={startBeeTour}
      aria-label="Replay the welcome tour"
      title="Replay the welcome tour"
    >
      <Sparkles className="size-4" />
    </Button>
  )
}

function findTarget(selectors?: string[]) {
  if (!selectors) return null
  for (const selector of selectors) {
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      const box = node.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) return box
    }
  }
  return null
}

export function BeeGuide() {
  const { workspace } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [box, setBox] = useState<DOMRect | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const current = STEPS[step]
  const last = step === STEPS.length - 1

  // First run: wait a beat so the page settles before the bee arrives.
  useEffect(() => {
    if (!workspace || read()) return
    const timer = window.setTimeout(() => setOpen(true), 900)
    return () => window.clearTimeout(timer)
  }, [workspace])

  useEffect(() => {
    const replay = () => {
      setStep(0)
      setOpen(true)
      requestAnimationFrame(() => nextRef.current?.focus())
    }
    window.addEventListener(START_EVENT, replay)
    return () => window.removeEventListener(START_EVENT, replay)
  }, [])

  const close = useCallback(() => {
    write()
    setOpen(false)
  }, [])

  const measure = useCallback(() => setBox(findTarget(current.target)), [current])
  useLayoutEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || !workspace) return null

  const pad = 6
  return (
    <>
      <div
        aria-hidden="true"
        className="bee-spot"
        data-on={box ? '' : undefined}
        style={
          box
            ? {
                width: box.width + pad * 2,
                height: box.height + pad * 2,
                transform: `translate(${box.left - pad}px, ${box.top - pad}px)`,
              }
            : undefined
        }
      />
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="bee-title"
        aria-describedby="bee-body"
        className="bee-guide"
      >
        <div className="bee-guide-bee" key={`${step}-${current.mood}`}>
          <Bee mood={current.mood} />
        </div>
        <div className="bee-guide-card">
          <div className="bee-guide-copy" key={step} aria-live="polite">
            <p className="eyebrow mb-2">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 id="bee-title" className="text-lg font-semibold tracking-tight">
              {current.title}
            </h2>
            <p id="bee-body" className="mt-1.5 text-sm leading-6 text-muted-foreground">
              {current.body}
            </p>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <ol className="bee-dots" aria-hidden="true">
              {STEPS.map((_, index) => (
                <li key={index} data-active={index === step ? '' : undefined} />
              ))}
            </ol>
            <div className="flex items-center gap-1.5">
              {!last && (
                <Button variant="ghost" size="sm" onClick={close}>
                  Skip
                </Button>
              )}
              {step > 0 && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous step"
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft className="size-3.5" />
                </Button>
              )}
              {last ? (
                <Button asChild size="sm" onClick={close}>
                  <Link route="documents.create" routeParams={{ workspaceId: workspace.id }}>
                    Start writing
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              ) : (
                <Button ref={nextRef} size="sm" onClick={() => setStep(step + 1)}>
                  {step === 0 ? 'Show me' : 'Next'}
                  <ArrowRight className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
