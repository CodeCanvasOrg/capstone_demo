import vine from '@vinejs/vine'

export const fileSchema = vine.object({
  filename: vine.string(),
  objectKey: vine.string(),
  objectUrl: vine.string(),
})
