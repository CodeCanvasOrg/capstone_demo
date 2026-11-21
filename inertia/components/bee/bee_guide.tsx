import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { useWorkspace } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Bee, type BeeMood } from './bee'

export const WELCOME_TOUR_KEY = 'codecanvas:bee-tour'
/** Fired when a tour is finished (not skipped), with the tour's storage key as the detail. */
export const TOUR_DONE_EVENT = 'bee:tour-done'

export type TourStep = {
  title: string
  body: string
  mood: BeeMood
  /** Tried in order; the first visible match is spotlit. No match means a centred message. */
  target?: string[]
  /** Leave the step out when none of its targets are on the page. */
  optional?: boolean
}

const WELCOME_STEPS: TourStep[] = [
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
    body: 'Your first case study is one click away. I’ll walk you through it when you get there.',
    mood: 'cheer',
  },
]

export function hasSeenTour(key: string) {
  try {
    return !!localStorage.getItem(key)
  } catch {
    return true
  }
}
function markSeen(key: string) {
  try {
    localStorage.setItem(key, 'done')
  } catch {
    /* private mode: the tour simply shows again next visit */
  }
}

/**
 * The sparkle button replays the tour for the page you are on, falling back to the welcome
 * tour. A page tour registers itself while mounted.
 */
const starters: { app: (() => void) | null; page: (() => void) | null } = { app: null, page: null }

export function startBeeTour() {
  ;(starters.page ?? starters.app)?.()
}

export function BeeTourButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={startBeeTour}
      aria-label="Replay the tour"
      title="Replay the tour"
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
      if (box.width > 0 && box.height > 0) return node
    }
  }
  return null
}

/** Keeps the card clear of the spotlit element: opposite side on wide screens, top or bottom on narrow ones. */
function placement(box: DOMRect | null) {
  if (!box) return {}
  const centreX = box.left + box.width / 2
  const centreY = box.top + box.height / 2
  if (window.innerWidth >= 768) return { side: centreX > window.innerWidth / 2 ? 'left' : 'right' }
  return { edge: centreY > window.innerHeight / 2 ? 'top' : 'bottom' }
}

export function BeeTour({
  steps,
  storageKey,
  scope,
  autoStart,
  finish,
}: {
  steps: TourStep[]
  storageKey: string
  scope: 'app' | 'page'
  /** Open on its own once this turns true, unless the tour was already seen. */
  autoStart: boolean
  /** The button on the last step. It receives `done`, which closes the tour. */
  finish: (done: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<TourStep[]>(steps)
  const [step, setStep] = useState(0)
  const [box, setBox] = useState<DOMRect | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const current = active[step] ?? active[0]
  const last = step === active.length - 1

  const begin = useCallback(() => {
    setActive(steps.filter((item) => !item.optional || findTarget(item.target)))
    setStep(0)
    setOpen(true)
  }, [steps])

  // First run: wait a beat so the page settles before the bee arrives.
  useEffect(() => {
    if (!autoStart || hasSeenTour(storageKey)) return
    const timer = window.setTimeout(begin, 900)
    return () => window.clearTimeout(timer)
  }, [autoStart, storageKey, begin])

  useEffect(() => {
    const replay = () => {
      begin()
      requestAnimationFrame(() => nextRef.current?.focus())
    }
    starters[scope] = replay
    return () => {
      if (starters[scope] === replay) starters[scope] = null
    }
  }, [scope, begin])

  const close = useCallback(() => {
    markSeen(storageKey)
    setOpen(false)
  }, [storageKey])

  const done = useCallback(() => {
    close()
    window.dispatchEvent(new CustomEvent(TOUR_DONE_EVENT, { detail: storageKey }))
  }, [close, storageKey])

  // Bring the target into view first; the scroll listener below then follows it.
  useEffect(() => {
    if (!open) return
    const node = findTarget(current.target)
    if (!node) return
    const rect = node.getBoundingClientRect()
    if (rect.top >= 0 && rect.bottom <= window.innerHeight) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [open, current])

  const measure = useCallback(
    () => setBox(findTarget(current.target)?.getBoundingClientRect() ?? null),
    [current]
  )
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

  if (!open || !current) return null

  const pad = 6
  const { side, edge } = placement(box)
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
        data-side={side}
        data-edge={edge}
      >
        <div className="bee-guide-bee" key={`${step}-${current.mood}`}>
          <Bee mood={current.mood} />
        </div>
        <div className="bee-guide-card">
          <div className="bee-guide-copy" key={step} aria-live="polite">
            <p className="eyebrow mb-2">
              Step {step + 1} of {active.length}
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
              {active.map((_, index) => (
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
                finish(done)
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

/** Part 1: the welcome tour, mounted once in the workspace layout. */
export function BeeGuide() {
  const { workspace } = useWorkspace()
  if (!workspace) return null
  return (
    <BeeTour
      steps={WELCOME_STEPS}
      storageKey={WELCOME_TOUR_KEY}
      scope="app"
      autoStart
      finish={(done) => (
        <Button asChild size="sm" onClick={done}>
          <Link route="documents.create" routeParams={{ workspaceId: workspace.id }}>
            Start writing
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      )}
    />
  )
}
