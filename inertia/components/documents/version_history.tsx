import { useEffect, useState } from 'react'
import type { Data } from '@generated/data'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { History } from 'lucide-react'
import { ImageExtension } from '@/components/extensions/image'
import { SourceCitation } from '@/components/extensions/source_citation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
const extensions = [StarterKit, ImageExtension, SourceCitation]
function Snapshot({ version }: { version: Data.DocumentVersion }) {
  const editor = useEditor({
    extensions,
    content: version.content,
    editable: false,
    immediatelyRender: false,
  })
  useEffect(() => {
    editor?.commands.setContent(version.content, { emitUpdate: false })
  }, [version.id, version.content, editor])
  return (
    <div className="tiptap-editor mt-5 rounded-lg border bg-background p-5">
      <EditorContent editor={editor} />
    </div>
  )
}
export function VersionHistory({ versions }: { versions: Data.DocumentVersion[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const version = versions.find((item) => item.id === selected) ?? versions[0]
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={!versions.length}>
          <History />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Saved versions</DialogTitle>
          <DialogDescription>
            Inspect an earlier saved version. The current working document stays unchanged.
          </DialogDescription>
        </DialogHeader>
        <select
          aria-label="Saved version"
          className="form-select"
          value={version?.id ?? ''}
          onChange={(event) => setSelected(event.target.value)}
        >
          {versions.map((item) => (
            <option key={item.id} value={item.id}>
              Version {item.version} ·{' '}
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''} ·{' '}
              {item.user?.fullName || item.user?.email || 'Workspace member'}
            </option>
          ))}
        </select>
        {version && <Snapshot version={version} />}
      </DialogContent>
    </Dialog>
  )
}
