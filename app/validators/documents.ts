import vine from '@vinejs/vine'
import { TEMPLATE_IDS } from '../../shared/templates/outlines.ts'
import { MAX_INSTRUCTIONS } from '../../shared/templates/instructions.ts'
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
  projectInformationContent: vine.any().nullable().optional(),
  sourceMode: vine.enum(['files', 'input_only']).optional(),
}
export const documentValidator = vine.create({
  // null writes a freeform case study; omitted keeps the portfolio outline.
  templateId: vine.enum(TEMPLATE_IDS).nullable().optional(),
  ...fields,
  // Optional steering for the model; an empty value falls back to the default instructions.
  instructions: vine.string().trim().maxLength(MAX_INSTRUCTIONS).nullable().optional(),
  // The brochure's page designs; their exact shape is enforced by the layout options on the server.
  brochure: vine.any().optional(),
  // Canvas options of "Use a template" and "Let AI choose"; checked by the creation service.
  canvas: vine.any().optional(),
  // Omitted titles are written by the model on the first successful generation.
  title: vine.string().trim().minLength(1).maxLength(255).optional(),
  files: vine
    .array(vine.object({ id: vine.string().uuid() }))
    .maxLength(100)
    .optional(),
})
export const documentUpdateValidator = vine.create({
  ...fields,
  metadataRevision: vine.number().withoutDecimals().min(0),
})
