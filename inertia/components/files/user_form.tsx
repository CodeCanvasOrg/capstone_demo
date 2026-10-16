import { useState } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { Button } from '@/components/ui/button'
import FileUploadForm from './form'
import type { FileUpload } from './card'
export default function UserForm() {
  const workspaceId = useWorkspaceId()
  const [files, setFiles] = useState<FileUpload[]>([])
  return (
    <div className="space-y-5">
      <FileUploadForm
        files={files}
        onSubmit={(file) => setFiles((current) => [...current, file])}
        onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Uploaded files are saved immediately in this workspace’s shared library. Removing a file
        from this list only dismisses its upload receipt.
      </p>
      <Button asChild variant="outline">
        <Link route="files.index" routeParams={{ workspaceId }}>
          Return to library
        </Link>
      </Button>
    </div>
  )
}
