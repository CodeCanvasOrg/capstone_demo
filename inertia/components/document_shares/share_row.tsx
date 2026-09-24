import { type Data } from '@generated/data'
import { Form, useRouter } from '@adonisjs/inertia/react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isShareRole, SHARE_ROLE_META, type ShareRole } from './roles'

type ShareRowProps = {
  documentId: string
  share: Data.DocumentShare
}

function ShareInitials({ share }: { share: Data.DocumentShare }) {
  const initials = share.user?.initials || share.user?.email?.charAt(0).toUpperCase() || '?'
  return (
    <span className="flex size-8 shrink-0 items-center justify-center border border-border bg-muted text-xs font-medium text-muted-foreground">
      {initials}
    </span>
  )
}

export function ShareRow({ documentId, share }: ShareRowProps) {
  const router = useRouter()

  function handleRoleChange(value: string) {
    if (!isShareRole(value)) return
    router.put(
      { route: 'shares.update', routeParams: { documentId, id: share.id } },
      { role: value }
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <ShareInitials share={share} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {share.user?.fullName || 'Unknown user'}
          </span>
          <span className="truncate text-sm text-muted-foreground">{share.user?.email}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={isShareRole(share.role) ? share.role : 'view'}
          onValueChange={handleRoleChange}
        >
          <SelectTrigger size="sm" aria-label="Change access role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SHARE_ROLE_META) as ShareRole[]).map((role) => (
              <SelectItem key={role} value={role}>
                {SHARE_ROLE_META[role].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Form route="shares.destroy" routeParams={{ documentId, id: share.id }}>
          <Button type="submit" variant="ghost" size="icon" aria-label="Remove access">
            <Trash2 className="size-4" />
          </Button>
        </Form>
      </div>
    </div>
  )
}
