import vine from '@vinejs/vine'
import { fileSchema } from './file.ts'

export const documentValidator = vine.create({
  title: vine.string().maxLength(255),
  description: vine.string().nullable(),
  status: vine.enum(['pending', 'draft', 'editing', 'approved']).nullable(),
  files: vine.array(fileSchema).nullable(),
})
