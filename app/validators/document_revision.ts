import vine from '@vinejs/vine'
export const documentRevisionValidator = vine.create({
  content: vine.object({}).allowUnknownProperties(),
  instruction: vine.string().trim().minLength(1).maxLength(2000),
})
