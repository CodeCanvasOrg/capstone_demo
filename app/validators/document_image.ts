import vine from '@vinejs/vine'

export const documentImageValidator = vine.create({
  file: vine.file({ size: '10mb', extnames: ['png', 'jpg', 'jpeg'] }),
})
