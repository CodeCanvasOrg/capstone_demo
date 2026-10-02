import { type Data } from '@generated/data'
import { Form, Link } from '@adonisjs/inertia/react'
import { MoreHorizontal } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown_menu'
import { TableCell, TableRow } from '@/components/ui/table'
import { GenerationStatusBadge, StatusBadge } from '@/components/documents/status'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

type DocumentCardProps = {
  document: Data.Document
}

export default function DocumentCard({ document }: DocumentCardProps) {
  return (
    <TableRow>
      <TableCell className="py-3 pl-5">
        <Link
          route="documents.edit"
          routeParams={{ id: document.id }}
          className="group flex min-w-0 flex-col gap-0.5"
        >
          <span className="font-medium group-hover:underline">
            {document.title || 'Untitled document'}
          </span>
          {document.description && (
            <span className="line-clamp-1 max-w-md text-sm text-muted-foreground">
              {document.description}
            </span>
          )}
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={document.status} />
          <GenerationStatusBadge status={document.generationStatus} />
        </div>
      </TableCell>
      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
        {document.updatedAt ? formatDate(document.updatedAt) : '—'}
      </TableCell>
      <TableCell className="pr-5 text-right">
        <AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild className={cn('rounded-none focus-visible:outline-none')}>
              <Button variant="ghost" size="icon" aria-label="Document actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link route="documents.edit" routeParams={{ id: document.id }}>
                  Edit
                </Link>
              </DropdownMenuItem>
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
              <AlertDialogTitle>Delete document?</AlertDialogTitle>
              <AlertDialogDescription>
                “{document.title || 'Untitled document'}” will be permanently deleted. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialogCancel>
              <Form route="documents.destroy" routeParams={{ id: document.id }}>
                <Button type="submit" variant="destructive">
                  Delete
                </Button>
              </Form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}
