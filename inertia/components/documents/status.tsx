import type { VariantProps } from 'class-variance-authority'
import { Badge, type badgeVariants } from '@/components/ui/badge'

export const DOCUMENT_STATUSES = ['pending', 'draft', 'editing', 'approved'] as const

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

export type GenerationStatus = 'uploaded' | 'processing' | 'generating' | 'ready' | 'failed'

export const STATUS_META: Record<DocumentStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pending', variant: 'outline' },
  draft: { label: 'Draft', variant: 'secondary' },
  editing: { label: 'Editing', variant: 'default' },
  approved: { label: 'Approved', variant: 'ghost' },
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status || !(status in STATUS_META)) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  const meta = STATUS_META[status as DocumentStatus]
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

const GENERATION_STATUS_META: Record<GenerationStatus, { label: string; variant: BadgeVariant }> = {
  uploaded: { label: 'Uploaded', variant: 'outline' },
  processing: { label: 'Indexing', variant: 'outline' },
  generating: { label: 'Generating', variant: 'secondary' },
  ready: { label: 'Ready', variant: 'secondary' },
  failed: { label: 'Failed', variant: 'destructive' },
}

export function GenerationStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status || !(status in GENERATION_STATUS_META)) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  const meta = GENERATION_STATUS_META[status as GenerationStatus]
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

export function ProcessingStatusBadge({ status }: { status: string | null | undefined }) {
  return <GenerationStatusBadge status={status} />
}
