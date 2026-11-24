import vine from '@vinejs/vine'

export const documentImageValidator = vine.create({
  file: vine.file({ size: '10mb', extnames: ['png', 'jpg', 'jpeg'] }),
})

/** Caption and alt text of a picture; null clears one. Both are optional. */
export const documentImageTextValidator = vine.create({
  caption: vine.string().trim().maxLength(400).nullable().optional(),
  altText: vine.string().trim().maxLength(300).nullable().optional(),
})
