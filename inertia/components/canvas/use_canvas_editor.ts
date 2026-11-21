import { useCallback, useEffect, useRef, useState } from 'react'
import { urlFor } from '@/client'
import { api, ApiError, feedbackError } from '@/lib/api'
import { parseCanvas, type CanvasDocument, type Frame } from '../../../shared/canvas/model.ts'
import type { BrandKit } from '../../../shared/layout/brand.ts'
import type { CanvasEditor } from './grapes/create_editor'
import type { TextEditing } from './grapes/text_editing'

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'conflict' | 'error'

type Options = {
  workspaceId: string
  documentId: string
  canvas: CanvasDocument
  revision: number
  baseVersionId: string | null
  brand: Pick<BrandKit, 'palette'> & { fonts: string[] }
}

const AUTOSAVE_MS = 1500

/**
 * Mounts the canvas editor and keeps it saved: changes autosave to the draft
 * after a pause; "Save version" makes a version. Two tabs cannot overwrite each
 * other (the draft revision must match), and a conflict stops autosave until
 * the page is reloaded.
 */
export function useCanvasEditor(options: Options) {
  // A callback ref held in state, so the editor mounts once the element exists.
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [canvasEditor, setCanvasEditor] = useState<CanvasEditor | null>(null)
  const [selected, setSelected] = useState<{ frame: Frame | null; sheetId: string | null }>({
    frame: null,
    sheetId: null,
  })
  const [overflow, setOverflow] = useState<string[]>([])
  const [textEditing, setTextEditing] = useState<TextEditing | null>(null)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [error, setError] = useState<string | null>(null)
  const [sheetIds, setSheetIds] = useState<string[]>(options.canvas.sheets.map((s) => s.id))
  const revision = useRef(options.revision)
  const baseVersionId = useRef(options.baseVersionId)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const statusRef = useRef<SaveStatus>('saved')
  const editorRef = useRef<CanvasEditor | null>(null)
  const params = { workspaceId: options.workspaceId, documentId: options.documentId }

  const setBoth = (next: SaveStatus) => {
    statusRef.current = next
    setStatus(next)
  }

  /** The current canvas, checked with the same rules as the server. */
  const current = useCallback((): CanvasDocument | null => {
    const ed = editorRef.current
    if (!ed) return null
    const parsed = parseCanvas(ed.read())
    if (parsed.ok) return parsed.canvas
    setError(`This layout cannot be saved: ${parsed.problems[0]?.message ?? 'invalid canvas'}`)
    return null
  }, [])

  const autosave = useCallback(async () => {
    if (statusRef.current === 'conflict') return
    const project = current()
    if (!project) return setBoth('error')
    setBoth('saving')
    try {
      const res = await api<{ data: { revision: number } }>(
        urlFor('documentCanvases.draft', params),
        'PUT',
        { project, revision: revision.current, baseVersionId: baseVersionId.current }
      )
      revision.current = res.data.revision
      // A change made while saving is saved next time round.
      if (statusRef.current === 'saving') setBoth('saved')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setBoth('conflict')
        setError(
          'This layout was changed in another tab or saved as a newer version. Reload to continue.'
        )
      } else {
        setBoth('error')
        setError(feedbackError(err).message)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, options.workspaceId, options.documentId])

  const changed = useCallback(() => {
    if (statusRef.current === 'conflict') return
    setBoth('unsaved')
    setSheetIds(editorRef.current?.sheets().map((s) => s.getId()) ?? [])
    clearTimeout(timer.current)
    timer.current = setTimeout(autosave, AUTOSAVE_MS)
  }, [autosave])

  const changedRef = useRef(changed)
  useEffect(() => {
    changedRef.current = changed
  }, [changed])

  useEffect(() => {
    let disposed = false
    let instance: CanvasEditor | null = null
    // GrapesJS is only loaded on this page.
    void Promise.all([
      import('grapesjs'),
      import('./grapes/create_editor'),
      import('grapesjs/dist/css/grapes.min.css'),
    ]).then(([grapes, { createCanvasEditor }]) => {
      if (disposed || !container) return
      instance = createCanvasEditor(grapes.default, {
        container,
        canvas: options.canvas,
        brand: options.brand,
        imageUrl: (imageId) => urlFor('documentImages.show', { ...params, imageId }),
        onChange: () => changedRef.current(),
        onSelect: (frame, sheetId) => setSelected({ frame, sheetId }),
        onOverflow: setOverflow,
        onTextEditing: setTextEditing,
      })
      editorRef.current = instance
      setCanvasEditor(instance)
    })
    const leave = (event: BeforeUnloadEvent) => {
      if (statusRef.current === 'unsaved' || statusRef.current === 'saving') event.preventDefault()
    }
    window.addEventListener('beforeunload', leave)
    return () => {
      disposed = true
      clearTimeout(timer.current)
      window.removeEventListener('beforeunload', leave)
      instance?.destroy()
      editorRef.current = null
    }
    // The editor is created once, when its element mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container])

  /** Saves the canvas as a new version of the document. */
  const saveVersion = useCallback(async () => {
    editorRef.current?.stopEditing()
    clearTimeout(timer.current)
    const project = current()
    if (!project) return null
    setBoth('saving')
    try {
      const res = await api<{ data: { versionId: string; version: number } }>(
        urlFor('documentCanvases.save', params),
        'POST',
        { project, baseVersionId: baseVersionId.current, mutationId: crypto.randomUUID() }
      )
      baseVersionId.current = res.data.versionId
      // The server cleared the draft.
      revision.current = 0
      setBoth('saved')
      setError(null)
      return res.data
    } catch (err) {
      setBoth(err instanceof ApiError && err.status === 409 ? 'conflict' : 'error')
      setError(feedbackError(err).message)
      return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, options.workspaceId, options.documentId])

  return {
    setContainer,
    canvasEditor,
    selected,
    overflow,
    textEditing,
    status,
    error,
    sheetIds,
    changed,
    saveVersion,
    dismissError: () => setError(null),
  }
}
