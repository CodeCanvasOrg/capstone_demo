import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
export type RichText = JSONContent
export const emptyRichText = (): RichText => ({ type: 'doc', content: [{ type: 'paragraph' }] })
export const textToRichText = (text: string): RichText => ({
  type: 'doc',
  content: text.split('\n').map((line) => ({
    type: 'paragraph',
    ...(line ? { content: [{ type: 'text', text: line }] } : {}),
  })),
})
export function RichTextEditor({
  value,
  onChange,
  onSubmit,
  label,
  placeholder = 'Write a description…',
  readOnly = false,
  compact = false,
  disabled = false,
  className,
}: {
  value?: RichText | null
  onChange?: (value: RichText, text: string) => void
  onSubmit?: () => void
  label: string
  placeholder?: string
  readOnly?: boolean
  compact?: boolean
  disabled?: boolean
  className?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, link: { openOnClick: readOnly } }),
    ],
    content: value ?? emptyRichText(),
    immediatelyRender: false,
    editable: !readOnly && !disabled,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (
          onSubmit &&
          !disabled &&
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.isComposing
        ) {
          event.preventDefault()
          onSubmit()
          return true
        }
        return false
      },
      attributes: {
        'role': 'textbox',
        'aria-label': label,
        'aria-multiline': 'true',
        'aria-readonly': String(readOnly || disabled),
      },
    },
    onUpdate: ({ editor: current }) => onChange?.(current.getJSON(), current.getText()),
  })
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      empty: current?.isEmpty ?? true,
      bold: current?.isActive('bold'),
      italic: current?.isActive('italic'),
      list: current?.isActive('bulletList'),
    }),
  })
  useEffect(() => {
    if (editor && value && JSON.stringify(editor.getJSON()) !== JSON.stringify(value))
      editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])
  useEffect(() => {
    editor?.setEditable(!readOnly && !disabled)
  }, [editor, readOnly, disabled])
  return (
    <div
      className={cn(
        'rich-description',
        readOnly && 'is-readonly',
        compact && 'is-compact',
        className
      )}
    >
      {!readOnly && (
        <div className="mb-2 flex gap-0.5" role="toolbar" aria-label={`${label} formatting`}>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Bold"
            aria-pressed={!!state?.bold}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Italic"
            aria-pressed={!!state?.italic}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Bullet list"
            aria-pressed={!!state?.list}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="size-3.5" />
          </Button>
        </div>
      )}
      <div className="relative" data-empty={state?.empty}>
        {state?.empty && !readOnly && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 text-sm text-muted-foreground"
          >
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
