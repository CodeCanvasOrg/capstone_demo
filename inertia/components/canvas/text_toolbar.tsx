import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Underline,
} from 'lucide-react'
import { useEffect, useReducer } from 'react'
import { IconButton } from '@/components/icon_button'
import type { TextEditing } from './grapes/text_editing'

/** Formatting for the text frame being edited. Shown only while one is. */
export function TextToolbar({ editing, onDone }: { editing: TextEditing; onDone: () => void }) {
  const tiptap = editing.tiptap
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    tiptap.on('transaction', refresh)
    return () => {
      tiptap.off('transaction', refresh)
    }
  }, [tiptap])
  const chain = () => tiptap.chain().focus()
  const on = (name: string, attrs?: Record<string, unknown>) => tiptap.isActive(name, attrs)
  const tool = (label: string, icon: typeof Bold, active: boolean, run: () => void) => (
    <IconButton
      label={label}
      icon={icon}
      variant={active ? 'secondary' : 'ghost'}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
    />
  )
  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex items-center gap-1 rounded-lg border bg-background px-1.5 py-1 shadow-sm"
    >
      {tool('Paragraph', Pilcrow, on('paragraph'), () => chain().setParagraph().run())}
      {tool('Heading', Heading2, on('heading', { level: 2 }), () =>
        chain().toggleHeading({ level: 2 }).run()
      )}
      {tool('Subheading', Heading3, on('heading', { level: 3 }), () =>
        chain().toggleHeading({ level: 3 }).run()
      )}
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      {tool('Bold', Bold, on('bold'), () => chain().toggleBold().run())}
      {tool('Italic', Italic, on('italic'), () => chain().toggleItalic().run())}
      {tool('Underline', Underline, on('underline'), () => chain().toggleUnderline().run())}
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      {tool('Bulleted list', List, on('bulletList'), () => chain().toggleBulletList().run())}
      {tool('Numbered list', ListOrdered, on('orderedList'), () =>
        chain().toggleOrderedList().run()
      )}
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs font-medium hover:bg-muted"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDone}
      >
        Done
      </button>
    </div>
  )
}
