import { Check, Clock, LoaderCircle, AlertCircle, PencilLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
const statuses: Record<string, { label: string; icon: typeof Clock }> = {
  pending: { label: 'Draft', icon: Clock },
  draft: { label: 'Draft', icon: Clock },
  editing: { label: 'Edited', icon: PencilLine },
  edited: { label: 'Edited', icon: PencilLine },
  in_review: { label: 'In review', icon: Clock },
  approved: { label: 'Approved', icon: Check },
}
export function StatusBadge({ status }: { status: string | null }) {
  const item = statuses[status ?? 'draft'] ?? statuses.draft
  return (
    <Badge
      variant="outline"
      className={
        status === 'approved' ? 'border-foreground/20 bg-primary/20 text-foreground' : 'bg-sidebar'
      }
    >
      <item.icon aria-hidden="true" className="size-3" />
      {item.label}
    </Badge>
  )
}
export function ProcessingStatusBadge({ status }: { status: string | null | undefined }) {
  const ready = status === 'ready'
  const failed = status === 'failed' || status === 'outdated'
  const Icon = ready ? Check : failed ? AlertCircle : LoaderCircle
  return (
    <Badge variant="outline" className="bg-sidebar">
      <Icon aria-hidden="true" className={`size-3 ${!ready && !failed ? 'animate-spin' : ''}`} />
      {ready
        ? 'Prepared'
        : failed
          ? 'Needs attention'
          : status === 'processing'
            ? 'Preparing'
            : status === 'checking_issues'
              ? 'Checking issues'
              : 'Queued'}
    </Badge>
  )
}
export function GenerationStatusBadge({ status }: { status: string | null | undefined }) {
  return <ProcessingStatusBadge status={status} />
}
