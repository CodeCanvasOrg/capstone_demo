import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Link } from '@adonisjs/inertia/react'
import { useWorkspaceId } from '@/providers/workspace_provider'
import { router } from '@inertiajs/react'
import { Search, ArrowLeft, ArrowRight } from 'lucide-react'
import { IconButton } from '@/components/icon_button'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
export type Pagination = { total: number; currentPage: number; lastPage: number; perPage: number }
export function CollectionSearch({
  collection,
  q = '',
  status = '',
  project = '',
  scope,
}: {
  collection: 'documents' | 'files' | 'projects'
  q?: string
  status?: string
  project?: string
  scope?: string
}) {
  const [term, setTerm] = useState(q)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = useRef<(() => void) | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      cancel.current?.()
    },
    []
  )
  const workspaceId = useWorkspaceId()
  function run(value: string) {
    if (timer.current) clearTimeout(timer.current)
    cancel.current?.()
    router.get(
      `/workspaces/${workspaceId}/${collection}`,
      { q: value, status, project, ...(scope ? { scope } : {}) },
      {
        preserveState: true,
        preserveScroll: true,
        replace: true,
        onCancelToken: (token) => {
          cancel.current = () => token.cancel()
        },
      }
    )
  }
  function search(event: FormEvent) {
    event.preventDefault()
    run(term)
  }
  return (
    <form onSubmit={search} role="search" className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="absolute top-3 left-3 size-4 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => {
            const value = event.target.value
            setTerm(value)
            cancel.current?.()
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => run(value), 350)
          }}
          maxLength={200}
          aria-label={`Search ${collection === 'documents' ? 'case studies' : collection}`}
          placeholder={`Search ${collection === 'documents' ? 'case studies' : collection}…`}
          className="h-10 bg-sidebar pl-9"
        />
      </div>
      <IconButton icon={Search} label="Search" type="submit" className="size-10" />
    </form>
  )
}
export function PaginationControls({
  pagination,
  collection,
  query = {},
}: {
  pagination?: Pagination
  collection: 'documents' | 'files' | 'projects'
  query?: Record<string, string>
}) {
  const workspaceId = useWorkspaceId()
  if (!pagination || pagination.lastPage < 2) return null
  const url = (page: number) =>
    `/workspaces/${workspaceId}/${collection}?${new URLSearchParams({ ...query, page: String(page) })}`
  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"
    >
      <span aria-label={`Page ${pagination.currentPage} of ${pagination.lastPage}`}>
        {pagination.currentPage} / {pagination.lastPage}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          title="Previous page"
          asChild={pagination.currentPage > 1}
          disabled={pagination.currentPage === 1}
        >
          {pagination.currentPage > 1 ? (
            <Link href={url(pagination.currentPage - 1)}>
              <ArrowLeft aria-hidden="true" />
            </Link>
          ) : (
            <>
              <ArrowLeft aria-hidden="true" />
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          title="Next page"
          asChild={pagination.currentPage < pagination.lastPage}
          disabled={pagination.currentPage >= pagination.lastPage}
        >
          {pagination.currentPage < pagination.lastPage ? (
            <Link href={url(pagination.currentPage + 1)}>
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <>
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </nav>
  )
}
