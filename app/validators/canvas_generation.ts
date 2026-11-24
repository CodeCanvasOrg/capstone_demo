import vine from '@vinejs/vine'

/**
 * Envelopes only. The options are checked by `canvasOptionsSchema`
 * (shared/canvas/academic/options.ts), the one schema the dialog, the layout
 * options and the CLI share, so they can never disagree.
 */
const mutationId = vine.string().trim().minLength(8).maxLength(100)
const baseVersionId = vine.string().uuid().nullable()

export const canvasGenerateValidator = vine.create({
  mutationId,
  baseVersionId,
  options: vine.any().optional(),
})

export const canvasRegenerateValidator = vine.create({
  mutationId,
  baseVersionId,
  mode: vine.enum(['rewrite', 'expand', 'condense'] as const),
})

export const canvasDesignValidator = vine.create({
  mutationId,
  baseVersionId,
  design: vine.string().trim().minLength(1).maxLength(32),
})
