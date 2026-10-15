import vine from '@vinejs/vine'
export const fileSchema = vine.object({ id: vine.string().uuid() })
export const fileValidator = vine.create({
  filename: vine.string().trim().minLength(1).maxLength(255),
})
export const filesValidator = vine.create({ files: vine.array(fileSchema).maxLength(100) })
