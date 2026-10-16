import type { ReactNode } from 'react'
import { FileText } from 'lucide-react'
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-sidebar/60 px-6 py-16 text-center">
      <span className="mb-5 grid size-12 place-items-center rounded-xl border bg-sidebar">
        <FileText aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 mb-6 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}
