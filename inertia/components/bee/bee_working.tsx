import { useCallback, useEffect, useRef, useState } from 'react'
import { urlFor } from '@/client'
import { api } from '@/lib/api'
import { useWorkspaceId } from '@/providers/workspace_provider'
import {
  resolveDesigns,
  type BrochureSelection,
  type DesignId,
} from '../../../shared/brochure/designs.ts'
import { GenerationField, type FieldPhase } from './generation_field'

const PHRASES = [
  'Buzzing through your notes…',
  'Gathering the sweetest facts…',
  'Pollinating ideas…',
  'Sketching the story arc…',
  'Choosing just the right words…',
  'Tucking in your citations…',
  'Smoothing out the honey…',
  'Lining up the layout…',
  'Almost ready to land…',
]

const INTERVAL = 3200
const CLOSE_MS = 240

type LayoutPayload = {
  data: { selection: { options: { brochure?: BrochureSelection; look?: string } } }
}

/**
 * The design of page one, so the swarm can form what the page will really look like. A brochure
 * has its own list of designs (the cover unless the author chose otherwise). A classic document
 * has no per-page design: the brochure look opens on the cover, the classic look on an article page.
 */
function useFirstPageDesign(documentId: string, enabled: boolean): DesignId {
  const workspaceId = useWorkspaceId()
  const [design, setDesign] = useState<DesignId>('cover')

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    api<LayoutPayload>(
      urlFor('documentLayouts.show', { workspaceId, documentId }),
      'GET',
      undefined,
      controller.signal
    )
      .then((body) => {
        const options = body.data.selection.options
        setDesign(
          options.brochure
            ? resolveDesigns(options.brochure.pages, 1)[0]
            : options.look === 'brochure'
              ? 'cover'
              : 'article'
        )
      })
      .catch(() => {})
    return () => controller.abort()
  }, [enabled, workspaceId, documentId])

  return design
}

/**
 * Bo pollinates the whole screen while a draft is generated: loose, blurred pollen turns into
 * the real first page as the draft comes together. The overlay stays mounted after `active`
 * flips so the swarm can finish and show the page (`failed` dissolves it instead), then fades
 * away. It never takes pointer events. Screen readers hear one stable status; the bubble and
 * the canvas are aria-hidden.
 */
export function BeeWorking({
  documentId,
  active,
  failed = false,
  design: fixedDesign,
}: {
  documentId: string
  active: boolean
  failed?: boolean
  /** The page the swarm forms. Given by callers that already know it (the canvas: its cover). */
  design?: DesignId
}) {
  const [mounted, setMounted] = useState(active)
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const closeTimer = useRef<number | undefined>(undefined)
  const fetched = useFirstPageDesign(documentId, mounted && !fixedDesign)
  const design = fixedDesign ?? fetched

  if (active && !mounted) setMounted(true)

  useEffect(() => {
    if (!active) return
    window.clearTimeout(closeTimer.current)
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [active])

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % PHRASES.length),
      INTERVAL
    )
    return () => window.clearInterval(timer)
  }, [active])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  const settle = useCallback(() => {
    setOpen(false)
    closeTimer.current = window.setTimeout(() => setMounted(false), CLOSE_MS)
  }, [])

  if (!mounted) return null

  const phase: FieldPhase = active ? 'running' : failed ? 'failed' : 'ready'
  const label =
    phase === 'running'
      ? 'Generating your draft. Saved content is safe.'
      : phase === 'ready'
        ? 'Draft ready.'
        : 'Draft generation stopped.'
  const line =
    phase === 'running' ? PHRASES[index] : phase === 'ready' ? 'Draft ready.' : 'Stopped.'

  return (
    <div role="status" className="bee-stage" data-open={open}>
      <span className="sr-only">{label}</span>
      <GenerationField phase={phase} design={design} onSettled={settle} />
      <div className="bee-working-bubble bee-stage-bubble" aria-hidden="true">
        <p key={line} className="bee-working-line">
          {line}
        </p>
        {phase === 'running' && <p className="bee-working-note">Saved content is safe.</p>}
      </div>
    </div>
  )
}
