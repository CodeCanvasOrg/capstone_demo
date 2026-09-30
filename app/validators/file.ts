import vine from '@vinejs/vine'

export const fileSchema = vine.object({
  filename: vine.string(),
  filetype: vine.string().nullable(),
  objectKey: vine.string(),
  objectUrl: vine.string(),
})

export const fileValidator = vine.create(fileSchema)

export const filesValidator = vine.create({
  files: vine.array(fileSchema),
})
