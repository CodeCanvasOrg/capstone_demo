import vine from '@vinejs/vine'

export const fileValidator = vine.create({
  file: vine.file({
    size: '10mb',
    extnames: ['pdf', 'docx', 'pptx', 'png', 'jpg', 'jpeg'],
  }),
})
