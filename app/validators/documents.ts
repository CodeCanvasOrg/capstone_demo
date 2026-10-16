import vine from '@vinejs/vine'
const projectInformation = vine.object({
  overview: vine.string().maxLength(20000).optional(),
  problemStatement: vine.string().maxLength(20000).optional(),
  workCompleted: vine.string().maxLength(20000).optional(),
  technicalApproach: vine.string().maxLength(20000).optional(),
  tools: vine.string().maxLength(20000).optional(),
  challenges: vine.string().maxLength(20000).optional(),
  results: vine.string().maxLength(20000).optional(),
})
const fields = {
  title: vine.string().trim().minLength(1).maxLength(255),
  descriptionContent: vine.any().nullable().optional(),
  description: vine.string().maxLength(20000).nullable().optional(),
  projectId: vine.string().uuid().nullable().optional(),
  dueDate: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  projectInformation: projectInformation.optional(),
  sourceMode: vine.enum(['files', 'input_only']).optional(),
}
export const documentValidator = vine.create({
  ...fields,
  files: vine
    .array(vine.object({ id: vine.string().uuid() }))
    .maxLength(100)
    .optional(),
})
export const documentUpdateValidator = vine.create({
  ...fields,
  metadataRevision: vine.number().withoutDecimals().min(0),
})
