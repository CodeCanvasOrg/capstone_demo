import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState, type JSONContent } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Undo2, Redo2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { projectInformationExtensions } from '../../../shared/project_information.ts'

export function ProjectFields({
  value,
  onChange,
  disabled = false,
  error,
}: {
  value: JSONContent
  onChange: (value: JSONContent) => void
  disabled?: boolean
  error?: string
}) {
  const editor = useEditor({
    extensions: [
      ...projectInformationExtensions(),
      Placeholder.configure({
        placeholder: 'Write here…',
        includeChildren: true,
        showOnlyCurrent: false,
      }),
    ],
    content: value,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        'role': 'textbox',
        'aria-label': 'Project information document',
        'aria-describedby': 'information-document-help',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
  })
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold'),
      italic: current?.isActive('italic'),
      bulletList: current?.isActive('bulletList'),
      orderedList: current?.isActive('orderedList'),
      canUndo: current?.can().undo(),
      canRedo: current?.can().redo(),
    }),
  })
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value))
      editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])
  useEffect(() => {
    editor?.setEditable(!disabled, false)
    editor?.view.dom.setAttribute('aria-readonly', String(disabled))
    editor?.view.dom.setAttribute('aria-invalid', String(!!error))
    editor?.view.dom.setAttribute(
      'aria-describedby',
      error ? 'information-document-error' : 'information-document-help'
    )
  }, [editor, disabled, error])
  const formats = [
    {
      label: 'Bold',
      icon: Bold,
      active: state?.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      icon: Italic,
      active: state?.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Bullet list',
      icon: List,
      active: state?.bulletList,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      icon: ListOrdered,
      active: state?.orderedList,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
  ]
  return (
    <section className="information-document" aria-label="Project information">
      <div
        className="sticky top-0 z-10 -mx-1 mb-6 flex flex-wrap items-center gap-0.5 bg-background py-2"
        role="toolbar"
        aria-label="Project information formatting"
      >
        {formats.map(({ label, icon: Icon, active, run }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={!!active}
            disabled={disabled || !editor}
            onMouseDown={(event) => event.preventDefault()}
            onClick={run}
          >
            <Icon className="size-4" aria-hidden="true" />
          </Button>
        ))}
        <span className="mx-2 h-4 border-l" aria-hidden="true" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          disabled={disabled || !state?.canUndo}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Redo"
          disabled={disabled || !state?.canRedo}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <p id="information-document-help" className="mb-8 text-xs text-muted-foreground">
        Complete each section before review.
      </p>
      {error && (
        <p id="information-document-error" role="alert" className="mb-3 text-xs text-destructive">
          {error}
        </p>
      )}
      <EditorContent editor={editor} />
    </section>
  )
}
export function TitleField({
  value,
  onChange,
  disabled = false,
  error,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="case-title" className="sr-only">
        Case-study title
      </Label>
      <input
        id="case-title"
        aria-invalid={!!error}
        aria-describedby={error ? 'case-title-error' : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Case-study title"
        disabled={disabled}
        className="w-full rounded-md bg-transparent py-2 text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-foreground/25 disabled:opacity-50"
        required
        maxLength={255}
      />
      {error && (
        <p id="case-title-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
