import vine from '@vinejs/vine'
export const invitationValidator = vine.create({
  email: vine.string().trim().email().maxLength(254).toLowerCase(),
})
