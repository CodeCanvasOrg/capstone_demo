import vine from '@vinejs/vine'

export const fileSchema = vine.object({
  id: vine.string().uuid(),
  filename: vine.string(),
  filetype: vine.string().nullable(),
  objectKey: vine.string(),
  objectUrl: vine.string(),
})

export const fileValidator = vine.create({
  filename: vine.string(),
  filetype: vine.string().nullable(),
  objectKey: vine.string(),
  objectUrl: vine.string(),
})

export const filesValidator = vine.create({
  files: vine.array(fileSchema),
})
