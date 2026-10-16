import { useState, type FormEvent } from 'react'
import { Link as LinkIcon } from 'lucide-react'
import { useToolbar } from './toolbar_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
export function LinkToolbar() {
  const { editor } = useToolbar()
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState('')
  const [error, setError] = useState('')
  function save(event: FormEvent) {
    event.preventDefault()
    if (!/^(https?:\/\/|mailto:)/i.test(href)) {
      setError('Use an https://, http://, or mailto: link.')
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setOpen(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) {
          setHref(editor.getAttributes('link').href ?? '')
          setError('')
        }
        setOpen(value)
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit link"
          aria-pressed={editor.isActive('link')}
        >
          <LinkIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit link</DialogTitle>
          <DialogDescription>
            Add a link to the selected text. Citation evidence is managed separately.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div className="space-y-2">
            <Label htmlFor="editor-link">Link address</Label>
            <Input
              id="editor-link"
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="https://example.com"
              required
            />
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button>Apply link</Button>
            {editor.isActive('link') && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run()
                  setOpen(false)
                }}
              >
                Remove link
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export function BlockStyleToolbar() {
  const { editor } = useToolbar()
  const level =
    ([1, 2, 3, 4] as const).find((value) => editor.isActive('heading', { level: value })) ?? 0
  return (
    <select
      aria-label="Text style"
      className="h-8 rounded-lg border bg-sidebar px-2 text-xs"
      value={String(level)}
      onChange={(event) => {
        const next = Number(event.target.value)
        if (next)
          editor
            .chain()
            .focus()
            .setHeading({ level: next as 1 | 2 | 3 | 4 })
            .run()
        else editor.chain().focus().setParagraph().run()
      }}
    >
      <option value="0">Body</option>
      <option value="1">Title</option>
      <option value="2">Heading</option>
      <option value="3">Subheading</option>
      <option value="4">Small heading</option>
    </select>
  )
}
