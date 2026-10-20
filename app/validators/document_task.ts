import vine from '@vinejs/vine'
export const generateValidator = vine.create({
  mutationId: vine.string().uuid(),
  baseVersionId: vine.string().uuid().nullable(),
})
export const sourceSelectionValidator = vine.create({
  baseVersionId: vine.string().uuid().nullable(),
  selectionRevision: vine.number().withoutDecimals().min(0),
  sourceMode: vine.enum(['files', 'input_only']),
  fileIds: vine.array(vine.string().uuid()).maxLength(100),
})
