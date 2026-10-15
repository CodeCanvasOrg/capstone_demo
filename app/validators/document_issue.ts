import vine from '@vinejs/vine'
const fields = {
  title: vine.string().trim().minLength(1).maxLength(255),
  description: vine.string().maxLength(10000).nullable().optional(),
  blocking: vine.boolean(),
}
export const issueValidator = vine.create(fields)
export const issueUpdateValidator = vine.create({
  ...fields,
  state: vine.enum(['open', 'resolved']),
  revision: vine.number().withoutDecimals().min(0),
})
