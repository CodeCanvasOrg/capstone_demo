export const SHARE_ROLES = ['view', 'edit'] as const

export type ShareRole = (typeof SHARE_ROLES)[number]

export const SHARE_ROLE_META: Record<ShareRole, { label: string }> = {
  view: { label: 'View' },
  edit: { label: 'Edit' },
}

export function isShareRole(value: string | null | undefined): value is ShareRole {
  return value === 'view' || value === 'edit'
}
