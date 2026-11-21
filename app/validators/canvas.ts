import vine from '@vinejs/vine'

/**
 * Envelopes only. The canvas itself is checked by parseCanvas (shared/canvas/model.ts),
 * the same allowlist the editor uses, so the two can never disagree.
 */
const project = vine.any()
const baseVersionId = vine.string().uuid().nullable()
const mutationId = vine.string().trim().minLength(8).maxLength(100)

export const canvasEnableValidator = vine.create({ mutationId })

export const canvasDraftValidator = vine.create({
  project,
  revision: vine.number().withoutDecimals().min(0),
  baseVersionId,
})

export const canvasSaveValidator = vine.create({ project, baseVersionId, mutationId })
