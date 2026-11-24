import { useCallback, useEffect, useRef, useState } from 'react'
import { urlFor } from '@/client'
import { api } from '@/lib/api'
import type { CanvasOptions } from '../../../shared/canvas/academic/options.ts'

/** What "Generate pages" sends and remembers. */
export type GenerationOptions = CanvasOptions

export type RunStatus =
  | 'queued'
  | 'planning'
  | 'retrieving'
  | 'writing'
  | 'fitting'
  | 'images'
  | 'composing'
  | 'ready'
  | 'failed'

/** One page of a run, as the server reports it. */
export type RunPage = {
  index: number
  design: string
  status: 'pending' | 'written' | 'fitted' | 'failed'
  purpose: string
  words: number | null
  fill: number | null
  citations: number
  placeholders: number
  dpi: number | null
  attempts: number
  notes: string[]
}

export type Run = {
  id: string
  status: RunStatus
  profile: string
  depth: string
  templateSet: string
  error: string | null
  resultVersionId: string | null
  pages: RunPage[]
}

export const ACTIVE: readonly RunStatus[] = [
  'queued',
  'planning',
  'retrieving',
  'writing',
  'fitting',
  'images',
  'composing',
]
export const isActive = (run: Run | null) => !!run && ACTIVE.includes(run.status)

/** The steps the progress shows, in order; "writing" names the page being written. */
export const STEPS = [
  { key: 'planning', label: 'Planning' },
  { key: 'retrieving', label: 'Gathering evidence' },
  { key: 'writing', label: 'Writing' },
  { key: 'fitting', label: 'Fitting' },
  { key: 'images', label: 'Placing images' },
  { key: 'composing', label: 'Laying out' },
] as const

/** "Writing page 3 of 8": the pages written so far, counted from the run's page rows. */
export function stepLabel(run: Run, key: (typeof STEPS)[number]['key']) {
  const step = STEPS.find((s) => s.key === key)!
  if (key !== 'writing') return step.label
  const total = run.pages.filter((p) => !['contents', 'references'].includes(p.design)).length
  const done = run.pages.filter((p) => p.status !== 'pending').length
  return total && run.status === 'writing'
    ? `Writing page ${Math.min(done + 1, total)} of ${total}`
    : step.label
}

/** Index of the run's current step, or -1 before it starts. */
export const stepIndex = (run: Run) =>
  run.status === 'queued'
    ? -1
    : run.status === 'ready'
      ? STEPS.length
      : STEPS.findIndex((s) => s.key === run.status)

export type Quality = { level: 'ok' | 'warn' | 'bad'; reasons: string[] }

/**
 * Amber when a page is under 70% full, cites fewer than two sources or has a picture
 * under 200 dpi; red when it has placeholders to fill in. Pages the application
 * writes (contents, references) have no quality to show.
 */
export function quality(page: RunPage): Quality | null {
  if (['contents', 'references'].includes(page.design)) return null
  const reasons: string[] = []
  let level: Quality['level'] = 'ok'
  if (page.placeholders > 0) {
    level = 'bad'
    reasons.push(`${page.placeholders} placeholder${page.placeholders === 1 ? '' : 's'} to fill in`)
  }
  const warn = (reason: string) => {
    if (level === 'ok') level = 'warn'
    reasons.push(reason)
  }
  if (page.fill !== null && page.fill < 0.7) warn(`${Math.round(page.fill * 100)}% full`)
  if (page.design !== 'title_page' && page.citations < 2)
    warn(page.citations ? 'One citation' : 'No citations')
  if (page.dpi !== null && page.dpi < 200)
    warn(`Picture is ${page.dpi} dpi (200 or more prints sharp)`)
  return { level, reasons }
}

type Params = { workspaceId: string; documentId: string }

/**
 * The latest run of the document, followed every two seconds while it is active.
 * `watch` starts following a run just requested.
 */
export function useGenerationRun(params: Params, initial: Run | null) {
  const [run, setRun] = useState<Run | null>(initial)
  const [following, setFollowing] = useState(isActive(initial))
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const refresh = useCallback(async () => {
    const res = await api<{ data: Run | null }>(
      urlFor('canvasGenerations.show', {
        workspaceId: params.workspaceId,
        documentId: params.documentId,
      })
    )
    setRun(res.data)
    return res.data
  }, [params.workspaceId, params.documentId])

  useEffect(() => {
    if (!following) return
    let cancelled = false
    const tick = async () => {
      try {
        const latest = await refresh()
        if (cancelled) return
        if (!isActive(latest)) {
          setFollowing(false)
          return
        }
      } catch {
        // A failed poll is tried again; the run itself is unaffected.
      }
      timer.current = setTimeout(tick, 2000)
    }
    timer.current = setTimeout(tick, 2000)
    return () => {
      cancelled = true
      clearTimeout(timer.current)
    }
  }, [following, refresh])

  return {
    run,
    following,
    refresh,
    watch: () => {
      setFollowing(true)
      void refresh().catch(() => {})
    },
  }
}
