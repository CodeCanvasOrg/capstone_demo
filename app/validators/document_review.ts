import vine from '@vinejs/vine'
const base = { baseVersionId: vine.string().uuid(), mutationId: vine.string().uuid() }
export const reviewValidator = vine.create(base)
export const approvalValidator = vine.create({
  ...base,
  reviewId: vine.string().uuid(),
  warningAcknowledgments: vine.array(vine.string().maxLength(128)).maxLength(200),
})
export const exportValidator = vine.create({
  approvalId: vine.string().uuid(),
  mutationId: vine.string().uuid(),
})
