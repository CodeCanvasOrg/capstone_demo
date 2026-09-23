import vine from '@vinejs/vine'

export const documentValidator = vine.create({
  title: vine.string().maxLength(255),
  description: vine.string().nullable(),
  status: vine.enum(['pending', 'draft', 'editing', 'approved']).nullable(),
})
