import vine from '@vinejs/vine'
export const briefValidator = vine.create({
  projectId: vine.string().uuid().nullable().optional(),
  fileIds: vine.array(vine.string().uuid()).maxLength(50).optional(),
  draft: vine.string().trim().maxLength(4000).nullable().optional(),
})
