import vine from '@vinejs/vine'

export const documentVersionValidator = vine.create({
  content: vine.object({}).allowUnknownProperties(),
})
