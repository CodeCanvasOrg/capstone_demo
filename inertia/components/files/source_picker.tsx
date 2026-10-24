import { useState, useRef, useEffect } from 'react'
import { Paperclip, Search, Library, Upload, Check } from 'lucide-react'
import type { Data } from '@generated/data'
import { useWorkspace } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import FileUploadForm from './form'
import type { FileUpload } from './card'
import { ProcessingStatusBadge } from '@/components/documents/status'
export type SourceChoice = Pick<Data.File, 'id' | 'filename' | 'processingStatus'>
export function SourcePicker({
  files,
  selected,
  onChange,
  disabled = false,
}: {
  files: SourceChoice[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const latestSelection = useRef(selected)
  useEffect(() => {
    latestSelection.current = selected
  }, [selected])
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('library')
  const [query, setQuery] = useState('')
  const [uploaded, setUploaded] = useState<FileUpload[]>([])
  const { dirtyKeys } = useWorkspace()
  const options = [...new Map([...files, ...uploaded].map((file) => [file.id, file])).values()]
  function allowLeave() {
    return (
      !dirtyKeys.includes('file-upload') ||
      window.confirm('Leave the staged upload? Files already uploaded remain in the library.')
    )
  }
  function changeOpen(next: boolean) {
    if (next || allowLeave()) setOpen(next)
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={disabled}>
          <Paperclip className="size-3.5" />
          {selected.length ? `${selected.length} sources` : 'Sources'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add source files</DialogTitle>
          <DialogDescription>Choose files or upload new ones.</DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(next) => {
            if (tab !== 'upload' || allowLeave()) setTab(next)
          }}
        >
          <TabsList>
            <TabsTrigger value="library">
              <Library aria-hidden="true" className="size-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload aria-hidden="true" className="size-4" />
              Upload
            </TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="space-y-3 pt-3">
            <div className="relative">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                aria-label="Search source library"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a file…"
                className="pl-9"
              />
            </div>
            <div className="max-h-80 overflow-y-auto divide-y">
              {options
                .filter((file) => (file.filename ?? '').toLowerCase().includes(query.toLowerCase()))
                .map((file) => (
                  <label
                    key={file.id}
                    className="flex cursor-pointer items-center gap-3 py-3 text-sm"
                  >
                    <Checkbox
                      checked={selected.includes(file.id)}
                      onCheckedChange={(checked) =>
                        onChange(
                          checked ? [...selected, file.id] : selected.filter((id) => id !== file.id)
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">{file.filename}</span>
                    <ProcessingStatusBadge status={file.processingStatus} />
                  </label>
                ))}
              {!options.length && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No files yet. Upload a source.
                </p>
              )}
              {!!options.length &&
                !options.some((file) =>
                  (file.filename ?? '').toLowerCase().includes(query.toLowerCase())
                ) && <p className="py-6 text-sm text-muted-foreground">No matching files.</p>}
            </div>
          </TabsContent>
          <TabsContent value="upload" className="space-y-3 pt-3">
            <FileUploadForm
              files={uploaded}
              onSubmit={(file) => {
                setUploaded((current) => [...current, file])
                latestSelection.current = [...latestSelection.current, file.id]
                onChange(latestSelection.current)
              }}
              onRemove={(index) => {
                const file = uploaded[index]
                onChange(selected.filter((id) => id !== file.id))
                setUploaded((current) => current.filter((_, i) => i !== index))
              }}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Uploads are saved to the library, even if you cancel this draft.
            </p>
          </TabsContent>
        </Tabs>
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          <Button type="button" size="sm" onClick={() => changeOpen(false)}>
            <Check aria-hidden="true" />
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
