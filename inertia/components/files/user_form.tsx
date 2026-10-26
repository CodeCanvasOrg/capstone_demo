import { ArrowLeft } from 'lucide-react'
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
      {files.length > 0 && (
        <p className="text-xs text-muted-foreground">Removing a receipt keeps the saved file.</p>
      )}
      <Button asChild variant="outline">
        <Link route="files.index" routeParams={{ workspaceId }}>
          <ArrowLeft aria-hidden="true" />
          Files
        </Link>
      </Button>
    </div>
  )
}
