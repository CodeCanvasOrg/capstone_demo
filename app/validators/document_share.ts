import vine from '@vinejs/vine'

export const SHARE_ROLES = ['view', 'edit'] as const
export type ShareRole = (typeof SHARE_ROLES)[number]

export const documentShareValidator = vine.create({
  emails: vine.string().trim(),
  role: vine.enum(SHARE_ROLES).optional(),
})

export const documentShareRoleValidator = vine.create({
  role: vine.enum(SHARE_ROLES),
})
