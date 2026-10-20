import vine from '@vinejs/vine'
export const documentVersionValidator = vine.create({
  content: vine.object({}).allowUnknownProperties(),
  baseVersionId: vine.string().uuid().nullable(),
  mutationId: vine.string().uuid(),
})
