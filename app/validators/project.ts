import vine from '@vinejs/vine'
export const createProjectValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120),
  description: vine.string().maxLength(10000).nullable().optional(),
})
export const updateProjectValidator = createProjectValidator
