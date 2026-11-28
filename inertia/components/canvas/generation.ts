import { useCallback, useEffect, useRef, useState } from 'react'
import { urlFor } from '@/client'
import { api } from '@/lib/api'
import type { CanvasOptions } from '../../../shared/canvas/options.ts'

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
  { key: 'planning', label: 'Planning the entries' },
  { key: 'retrieving', label: 'Gathering evidence' },
  { key: 'images', label: 'Choosing pictures' },
  { key: 'writing', label: 'Writing' },
  { key: 'fitting', label: 'Writing the cover' },
  { key: 'composing', label: 'Laying out' },
] as const

/** "Writing entry 2 of 4": the entries written so far, counted from the run's page rows. */
export function stepLabel(run: Run, key: (typeof STEPS)[number]['key']) {
  const step = STEPS.find((s) => s.key === key)!
  if (key !== 'writing') return step.label
  const entries = run.pages.filter((p) => p.design === 'entry')
  const done = entries.filter((p) => p.status !== 'pending').length
  return entries.length && run.status === 'writing'
    ? `Writing entry ${Math.min(done + 1, entries.length)} of ${entries.length}`
    : step.label
}

/**
 * What a page is called in the strip: the cover, Entry 2, and the Sources of that entry.
 * Entries are counted in page order, so a sources page takes the number of the entry before it.
 */
export function pageLabel(pages: readonly Pick<RunPage, 'design'>[], index: number) {
  const design = pages[index]?.design
  if (design === 'cover') return 'Cover'
  if (design !== 'entry' && design !== 'sources') return (design ?? '').replaceAll('_', ' ')
  const entry = pages.slice(0, index + 1).filter((p) => p.design === 'entry').length
  const part =
    design === 'sources'
      ? pages
          .slice(0, index)
          .filter(
            (p, i) =>
              p.design === 'sources' &&
              pages.slice(0, i).filter((q) => q.design === 'entry').length === entry
          ).length
      : 0
  return design === 'entry' ? `Entry ${entry}` : `Sources ${entry}${part ? ` (${part + 1})` : ''}`
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
 * Amber when an entry uses under 70% of its rows' space, cites fewer than two sources or has a
 * picture under 200 dpi; red when it has placeholders to fill in. The cover and the sources
 * pages (which the application writes) have no quality to show.
 */
export function quality(page: RunPage): Quality | null {
  if (page.design !== 'entry') return null
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
  if (page.citations < 2) warn(page.citations ? 'One citation' : 'No citations')
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
