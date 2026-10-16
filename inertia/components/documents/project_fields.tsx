import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState, type JSONContent } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Undo2, Redo2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { projectInformationExtensions } from '../../../shared/project_information.ts'

export function ProjectFields({
  value,
  onChange,
  disabled = false,
}: {
  value: JSONContent
  onChange: (value: JSONContent) => void
  disabled?: boolean
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
  }, [editor, disabled])
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
        Write freely under each heading. Use paragraphs, lists, or Markdown shortcuts to format your
        notes.
      </p>
      <EditorContent editor={editor} />
    </section>
  )
}
export function TitleField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="case-title">Case-study title</Label>
      <Input
        id="case-title"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        maxLength={255}
      />
    </div>
  )
}
