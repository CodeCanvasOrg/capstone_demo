import { useWorkspaceId, useUnsavedChanges } from '@/providers/workspace_provider'
import { router } from '@inertiajs/react'
import { EditorContent, type JSONContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef, useState } from 'react'
import { Save, Download, LoaderCircle } from 'lucide-react'
import { urlFor } from '@/client'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ToolbarProvider } from '@/components/toolbars/toolbar_provider'
import { LinkToolbar, BlockStyleToolbar } from '@/components/toolbars/link'
import { BoldToolbar } from '@/components/toolbars/bold'
import { ItalicToolbar } from '@/components/toolbars/italic'
import { BulletListToolbar } from '@/components/toolbars/bullet_list'
import { OrderedListToolbar } from '@/components/toolbars/ordered_list'
import { UndoToolbar } from '@/components/toolbars/undo'
import { RedoToolbar } from '@/components/toolbars/redo'
import { SourceCitation } from '@/components/extensions/source_citation'
import { ImageExtension } from '@/components/extensions/image'
import { writingReveal } from '../../../shared/writing_reveal.ts'
const EMPTY = { type: 'doc', content: [{ type: 'paragraph' }] }
const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
  SourceCitation,
  ImageExtension,
  Placeholder.configure({ placeholder: 'Tell the story of the work…' }),
]
type Pending = { content: JSONContent; baseVersionId: string | null; mutationId: string }
export default function DocumentEditor({
  documentId,
  initialContent,
  baseVersionId,
  onDirtyChange,
  generationStatus,
  title,
}: {
  documentId: string
  initialContent: JSONContent | null
  baseVersionId: string | null
  onDirtyChange?: (dirty: boolean) => void
  generationStatus?: string | null
  title: string
}) {
  const workspaceId = useWorkspaceId()
  const base = useRef(baseVersionId)
  const lastServer = useRef(baseVersionId)
  const accepted = useRef(new Set<string>())
  const pending = useRef<Pending | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busy = useRef(false)
  const changed = useRef(false)
  const mounted = useRef(true)
  const blocked = useRef(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [writing, setWriting] = useState(false)
  const waitingForGeneration = useRef(generationStatus === 'processing')
  const frame = useRef<number | null>(null)
  const finishWriting = useRef<() => void>(() => {})
  useUnsavedChanges(`editor-${documentId}`, dirty || saving)
  useEffect(() => {
    onDirtyChange?.(dirty || saving || writing)
  }, [dirty, saving, writing, onDirtyChange])
  const saveRef = useRef<() => Promise<void>>(async () => {})
  const editor = useEditor({
    extensions,
    content: initialContent ?? EMPTY,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': 'Case-study content',
        'role': 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: () => {
      changed.current = true
      setDirty(true)
      if (timer.current) clearTimeout(timer.current)
      if (!blocked.current) timer.current = setTimeout(() => void saveRef.current(), 1000)
    },
  })
  useEffect(() => {
    editor?.setEditable(generationStatus !== 'processing' && !writing, false)
    if (generationStatus === 'processing') waitingForGeneration.current = true
    if (generationStatus === 'failed') waitingForGeneration.current = false
  }, [editor, generationStatus, writing])
  useEffect(() => {
    saveRef.current = async () => {
      if (!editor || busy.current || blocked.current || !changed.current) return
      busy.current = true
      setSaving(true)
      setError('')
      const intent = pending.current ?? {
        content: editor.getJSON(),
        baseVersionId: base.current,
        mutationId: crypto.randomUUID(),
      }
      pending.current = intent
      try {
        const result = await api<{ data: { version: { id: string } } }>(
          urlFor('documentVersions.store', { workspaceId, documentId }),
          'POST',
          intent
        )
        if (!mounted.current) return
        base.current = result.data.version.id
        accepted.current.add(result.data.version.id)
        pending.current = null
        changed.current = JSON.stringify(editor.getJSON()) !== JSON.stringify(intent.content)
        setDirty(changed.current)
        router.reload({ only: ['document', 'workflow', 'recentDocuments'] })
        if (changed.current) timer.current = setTimeout(() => void saveRef.current(), 1000)
      } catch (reason) {
        if (!mounted.current) return
        setError(
          !navigator.onLine
            ? 'You are offline. Your local changes remain here. Retry when connected.'
            : reason instanceof Error
              ? reason.message
              : 'Unable to save. Your changes remain here.'
        )
        if (reason instanceof ApiError && reason.status === 409) {
          blocked.current = true
          setConflict(true)
          router.reload({ only: ['document', 'workflow'] })
        }
      } finally {
        busy.current = false
        if (mounted.current) setSaving(false)
      }
    }
  }, [editor, workspaceId, documentId])
  useEffect(() => {
    if (!editor || lastServer.current === baseVersionId) return
    lastServer.current = baseVersionId
    if (baseVersionId && accepted.current.has(baseVersionId)) return
    if (changed.current || busy.current) {
      blocked.current = true
      setConflict(true)
      setError(
        'Another member saved a newer version. Your local changes are still here. Download them before loading the latest version.'
      )
      if (timer.current) clearTimeout(timer.current)
      return
    }
    base.current = baseVersionId
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    const content = initialContent ?? EMPTY
    if (
      waitingForGeneration.current &&
      baseVersionId &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      waitingForGeneration.current = false
      const full = editor.schema.nodeFromJSON(content)
      const length = full.content.size
      const start = performance.now()
      const duration = Math.min(4000, Math.max(1200, length * 2))
      setWriting(true)
      editor.setEditable(false, false)
      finishWriting.current = () => {
        if (frame.current !== null) cancelAnimationFrame(frame.current)
        frame.current = null
        editor
          .chain()
          .setContent(content, { emitUpdate: false })
          .setMeta('addToHistory', false)
          .run()
        setWriting(false)
      }
      editor.chain().setContent(EMPTY, { emitUpdate: false }).setMeta('addToHistory', false).run()
      const reveal = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        if (progress === 1) {
          finishWriting.current()
          return
        }
        editor
          .chain()
          .setContent(writingReveal(full, progress), { emitUpdate: false })
          .setMeta('addToHistory', false)
          .run()
        frame.current = requestAnimationFrame(reveal)
      }
      frame.current = requestAnimationFrame(reveal)
    } else {
      waitingForGeneration.current = false
      setWriting(false)
      editor.chain().setContent(content, { emitUpdate: false }).setMeta('addToHistory', false).run()
    }
  }, [baseVersionId, initialContent, editor])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) clearTimeout(timer.current)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])
  useEffect(() => {
    if (!writing) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      if (media.matches) finishWriting.current()
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [writing])
  function downloadLocal() {
    if (!editor) return
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(editor.getJSON(), null, 2)], { type: 'application/json' })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'case-study-local-draft.json'
    link.click()
    URL.revokeObjectURL(url)
  }
  function loadLatest() {
    if (!window.confirm('Discard your local changes and load the latest saved version?')) return
    blocked.current = false
    pending.current = null
    changed.current = false
    base.current = baseVersionId
    editor?.commands.setContent(initialContent ?? EMPTY, { emitUpdate: false })
    setDirty(false)
    setError('')
    setConflict(false)
  }
  if (!editor)
    return (
      <div role="status" className="p-10 text-sm text-muted-foreground">
        Loading editor…
      </div>
    )
  return (
    <section className="min-w-0 flex-1">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-sidebar px-4 py-2">
        <ToolbarProvider editor={editor}>
          <div
            className="flex flex-wrap items-center gap-0.5"
            inert={writing || generationStatus === 'processing'}
          >
            <UndoToolbar />
            <RedoToolbar />
            <span className="mx-2 h-5 border-l" />
            <BlockStyleToolbar />
            <BoldToolbar />
            <ItalicToolbar />
            <LinkToolbar />
            <BulletListToolbar />
            <OrderedListToolbar />
          </div>
        </ToolbarProvider>
        <div className="ml-auto flex items-center gap-2">
          <span role="status" className="text-[.625rem] text-muted-foreground">
            {writing
              ? 'Writing your draft…'
              : generationStatus === 'processing'
                ? 'Generating…'
                : saving
                  ? 'Saving…'
                  : error
                    ? 'Needs attention'
                    : dirty
                      ? 'Unsaved changes'
                      : 'Saved'}
          </span>
          {writing && (
            <Button variant="ghost" size="sm" onClick={() => finishWriting.current()}>
              Show full draft
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={!dirty || saving || conflict}
            onClick={() => void saveRef.current()}
          >
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}Save
          </Button>
        </div>
      </div>
      {error && (
        <div role="alert" className="space-y-3 border-b border-destructive/30 bg-sidebar p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadLocal}>
              <Download />
              Download local draft
            </Button>
            {conflict ? (
              <Button variant="outline" size="sm" onClick={loadLatest}>
                Load latest version
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void saveRef.current()}
                disabled={saving}
              >
                Retry save
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="min-h-[85vh] bg-background px-3 py-6 sm:px-7 sm:py-10">
        <div
          className="document-canvas tiptap-editor mx-auto"
          aria-busy={writing || generationStatus === 'processing'}
        >
          <div className="mb-10 flex items-center justify-between gap-4 text-[.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
            <span>Case study</span>
            <span>{baseVersionId ? 'Working draft' : 'First draft'}</span>
          </div>
          {!baseVersionId && (
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                {generationStatus === 'processing'
                  ? 'We’re preparing your story. Your draft will appear here.'
                  : 'Your document is ready to write.'}
              </p>
            </div>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
    </section>
  )
}
