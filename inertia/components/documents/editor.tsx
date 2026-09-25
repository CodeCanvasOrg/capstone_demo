'use client'

import { useRouter } from '@adonisjs/inertia/react'
import { EditorContent, type JSONContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { LoaderCircle, Minus, Plus, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ToolbarProvider } from '@/components/toolbars/toolbar_provider'
import { BlockquoteToolbar } from '@/components/toolbars/blockquote'
import { BoldToolbar } from '@/components/toolbars/bold'
import { BulletListToolbar } from '@/components/toolbars/bullet_list'
import { CodeToolbar } from '@/components/toolbars/code'
import { CodeBlockToolbar } from '@/components/toolbars/code_block'
import { HardBreakToolbar } from '@/components/toolbars/hard_break'
import { HorizontalRuleToolbar } from '@/components/toolbars/horizontal_rule'
import { ItalicToolbar } from '@/components/toolbars/italic'
import { OrderedListToolbar } from '@/components/toolbars/ordered_list'
import { RedoToolbar } from '@/components/toolbars/redo'
import { StrikeThroughToolbar } from '@/components/toolbars/strikethrough'
import { UndoToolbar } from '@/components/toolbars/undo'

const extensions = [
  StarterKit.configure({
    orderedList: {
      HTMLAttributes: {
        class: 'list-decimal',
      },
    },
    bulletList: {
      HTMLAttributes: {
        class: 'list-disc',
      },
    },
    code: {
      HTMLAttributes: {
        class: 'rounded-md bg-accent p-1',
      },
    },
    horizontalRule: {
      HTMLAttributes: {
        class: 'my-2',
      },
    },
    codeBlock: {
      HTMLAttributes: {
        class: 'rounded-md bg-muted p-3 text-sm',
      },
    },
    heading: {
      levels: [1, 2, 3, 4],
    },
  }),
  Markdown,
]

type SaveState = 'idle' | 'saving' | 'error'

const ZOOM_OPTIONS = [50, 75, 90, 100, 110, 120, 150, 200] as const
type Zoom = (typeof ZOOM_OPTIONS)[number]

type DocumentEditorProps = {
  documentId: string
  initialContent: JSONContent | null
}

export default function DocumentEditor({ documentId, initialContent }: DocumentEditorProps) {
  const router = useRouter()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [zoom, setZoom] = useState<Zoom>(100)

  function zoomIn() {
    setZoom((current) => ZOOM_OPTIONS.find((level) => level > current) ?? current)
  }

  function zoomOut() {
    setZoom((current) => [...ZOOM_OPTIONS].reverse().find((level) => level < current) ?? current)
  }

  const editor = useEditor({
    extensions,
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      const content = instance.getJSON()

      setSaveState('saving')
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }

      saveTimer.current = setTimeout(() => {
        router.post(
          { route: 'documentVersions.store', routeParams: { documentId } },
          { content },
          {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setSaveState('idle'),
            onError: () => setSaveState('error'),
          }
        )
      }, 800)
    },
  })

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
    }
  }, [])

  if (!editor) {
    return null
  }

  return (
    <div className="w-full">
      <div className="sticky top-14 z-20 flex items-center gap-1 border-b border-border/60 bg-background/95 px-4 py-1.5 backdrop-blur md:px-10">
        <ToolbarProvider editor={editor}>
          <div className="flex flex-wrap items-center gap-1">
            <UndoToolbar />
            <RedoToolbar />
            <Separator orientation="vertical" className="mx-1 h-7" />
            <BoldToolbar />
            <ItalicToolbar />
            <StrikeThroughToolbar />
            <Separator orientation="vertical" className="mx-1 h-7" />
            <BulletListToolbar />
            <OrderedListToolbar />
            <CodeToolbar />
            <CodeBlockToolbar />
            <HorizontalRuleToolbar />
            <BlockquoteToolbar />
            <HardBreakToolbar />
          </div>
        </ToolbarProvider>

        <div className="ml-auto flex items-center gap-1.5">
          {saveState === 'saving' ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LoaderCircle className="size-3 animate-spin" />
              Saving…
            </span>
          ) : saveState === 'error' ? (
            <span className="flex items-center gap-1.5 text-xs text-destructive">
              <XCircle className="size-3" />
              Failed to save
            </span>
          ) : (
            <span className="hidden text-xs text-muted-foreground sm:block">All changes saved</span>
          )}

          <Separator orientation="vertical" className="mx-2 h-7" />

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={zoomOut}
            disabled={zoom === ZOOM_OPTIONS[0]}
            aria-label="Zoom out"
          >
            <Minus className="size-4" />
          </Button>
          <Select value={String(zoom)} onValueChange={(value) => setZoom(Number(value) as Zoom)}>
            <SelectTrigger className="h-7 w-[70px] gap-1 border-0 bg-transparent px-2 text-xs shadow-none hover:bg-muted focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {ZOOM_OPTIONS.map((level) => (
                <SelectItem key={level} value={String(level)}>
                  {level}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={zoomIn}
            disabled={zoom === ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]}
            aria-label="Zoom in"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex w-full justify-center px-4 py-10">
        <div
          className="w-[210mm] max-w-full bg-card text-card-foreground"
          style={{ zoom: zoom / 100 }}
        >
          <div
            className="tiptap-editor min-h-[240mm] w-full cursor-text px-10 py-14 sm:px-16"
            onClick={() => editor?.chain().focus().run()}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  )
}
