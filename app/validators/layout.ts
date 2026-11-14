import vine from '@vinejs/vine'

const pin = {
  templateId: vine.string().trim().minLength(1).maxLength(64),
  templateVersion: vine.number().withoutDecimals().min(1).optional(),
  brandVersion: vine.number().withoutDecimals().min(1).optional(),
  // Shape is validated against the chosen template by the layout service.
  options: vine.any().optional(),
}

export const catalogValidator = vine.create({ docType: vine.string().maxLength(32).optional() })

export const layoutSelectionValidator = vine.create({
  ...pin,
  baseRevision: vine.number().withoutDecimals().min(0),
})

export const applyPresetValidator = vine.create({
  presetId: vine.string().uuid(),
  baseRevision: vine.number().withoutDecimals().min(0),
})

export const presetCreateValidator = vine.create({ name: vine.string().maxLength(80), ...pin })

export const presetUpdateValidator = vine.create({
  name: vine.string().maxLength(80).optional(),
  templateId: pin.templateId.clone().optional(),
  templateVersion: pin.templateVersion,
  brandVersion: pin.brandVersion,
  options: pin.options,
})

export const presetDuplicateValidator = vine.create({ name: vine.string().maxLength(80) })

const wrapper = vine.object({
  about: vine.string().trim().maxLength(1200).optional(),
  contact: vine
    .object({
      email: vine.string().email().maxLength(160).optional(),
      website: vine.string().url().maxLength(300).optional(),
      phone: vine.string().maxLength(40).optional(),
    })
    .optional(),
})

export const collectionCreateValidator = vine.create({
  name: vine.string().maxLength(120),
  entryIds: vine.array(vine.string().uuid()).maxLength(100),
  wrapper,
})

export const collectionUpdateValidator = vine.create({
  name: vine.string().maxLength(120).optional(),
  entryIds: vine.array(vine.string().uuid()).maxLength(100).optional(),
  wrapper: wrapper.clone().optional(),
  baseHash: vine.string().fixedLength(64),
})

export const collectionApprovalValidator = vine.create({ baseHash: vine.string().fixedLength(64) })
export const collectionBudgetValidator = vine.create({
  target: vine.number().withoutDecimals().min(1).max(500).optional(),
})
