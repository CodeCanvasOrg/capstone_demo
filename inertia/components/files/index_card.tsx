import { useWorkspaceId } from '@/providers/workspace_provider'
import { type Data } from '@generated/data'
import { Form, Link } from '@adonisjs/inertia/react'
import { FileImage, FileText, MoreHorizontal } from 'lucide-react'
import { cn } from 'cn'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert_dialog'
import { Badge } from '@/components/ui/badge'
import { ProcessingStatusBadge } from '@/components/documents/status'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown_menu'
import { TableCell, TableRow } from '@/components/ui/table'

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg']

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isImageFile(filetype: string | null) {
  return filetype ? IMAGE_EXTENSIONS.includes(filetype) : false
}

type FileIndexCardProps = {
  file: Data.File
}

export default function FileIndexCard({ file }: FileIndexCardProps) {
  const workspaceId = useWorkspaceId()
  const isImage = isImageFile(file.filetype)
  const name = file.filename || 'Untitled file'

  return (
    <TableRow role="row">
      <TableCell role="cell" className="py-3 pl-5">
        <div className="flex min-w-0 items-center gap-3">
          {isImage && file.downloadUrl ? (
            <img
              src={file.downloadUrl}
              alt=""
              className="size-9 shrink-0 border border-border object-cover"
            />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center border border-border">
              {isImage ? (
                <FileImage className="size-4 text-muted-foreground" />
              ) : (
                <FileText className="size-4 text-muted-foreground" />
              )}
            </span>
          )}

          <div className="flex min-w-0 flex-col gap-0.5">
            {file.downloadUrl ? (
              <Link
                route="files.edit"
                routeParams={{ workspaceId, id: file.id }}
                className="truncate font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                title={name}
              >
                {name}
              </Link>
            ) : (
              <span className="truncate font-medium" title={name}>
                {name}
              </span>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell role="cell">
        <Badge variant="outline">{file.filetype?.replace('.', '').toUpperCase() ?? 'FILE'}</Badge>
      </TableCell>

      <TableCell role="cell">
        <ProcessingStatusBadge status={file.processingStatus} />
      </TableCell>

      <TableCell role="cell" className="hidden text-sm text-muted-foreground sm:table-cell">
        {file.createdAt ? formatDate(file.createdAt) : '—'}
      </TableCell>

      <TableCell role="cell" className="pr-5 text-right">
        <AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild className={cn('rounded-none focus-visible:outline-none')}>
              <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {file.downloadUrl && (
                <DropdownMenuItem asChild>
                  <Link route="files.edit" routeParams={{ workspaceId, id: file.id }}>
                    Edit
                  </Link>
                </DropdownMenuItem>
              )}
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(event) => event.preventDefault()}
                >
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete file?</AlertDialogTitle>
              <AlertDialogDescription>
                “{name}” will be permanently deleted. This action cannot be undone
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialogCancel>
              <Form route="files.destroy" routeParams={{ workspaceId, id: file.id }}>
                {({ processing }) => (
                  <Button type="submit" variant="destructive" disabled={processing}>
                    {processing ? 'Deleting…' : 'Delete'}
                  </Button>
                )}
              </Form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}
