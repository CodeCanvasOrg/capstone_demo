import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import AccessService, {
  missingResource,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import { fingerprint } from '#services/workspaces/task_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import {
  BRANDED_TEMPLATE_ID,
  TEMPLATE_IDS,
  outlineSections,
  type OutlineDefinition,
  type OutlineTemplate,
} from '../../../shared/templates/outlines.ts'

const catalog = {
  case_study: {
    name: 'Branded case study',
    description:
      'Hero, key results, challenge, solution, steps and capabilities for the branded layout.',
  },
  portfolio: {
    name: 'Website portfolio entry',
    description: 'The challenge, solution, capabilities and supported impact.',
  },
  technical: {
    name: 'Technical portfolio entry',
    description: 'Architecture, implementation, evaluation and impact.',
  },
  vision: {
    name: 'Product vision',
    description: 'The user need, product experience, availability and roadmap.',
  },
} as const

export default class OutlineTemplateService {
  async list(context: WorkspaceAccessContext): Promise<OutlineTemplate[]> {
    await new AccessService().resolve(context.actorId, context.workspaceId)
    return Promise.all(TEMPLATE_IDS.map((id) => this.resolve(id)))
  }
  async resolve(id: string): Promise<OutlineTemplate> {
    if (!TEMPLATE_IDS.includes(id as (typeof TEMPLATE_IDS)[number])) throw missingResource()
    const instructions = await readFile(
      app.makePath(`resources/document_templates/${id}.md`),
      'utf8'
    )
    const outline = /```markdown\n([\s\S]*?)\n```/.exec(instructions)?.[1]
    if (!outline) throw new Error(`Company template ${id} is missing its output structure`)
    outlineSections(outline)
    const definition: OutlineDefinition = {
      schemaVersion: 2,
      ...catalog[id as keyof typeof catalog],
      instructions,
      outline,
      ...(id === BRANDED_TEMPLATE_ID ? { format: 'branded_entry' as const } : {}),
    }
    return { id, revision: fingerprint(definition), definition }
  }
  skeleton(definition: OutlineDefinition, title: string): TipTapDocument {
    return {
      type: 'doc',
      content: outlineSections(definition.outline).flatMap((section, i) => [
        {
          type: 'heading',
          attrs: { level: section.level },
          content: [{ type: 'text', text: i === 0 ? title : section.heading }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: section.placeholder || '<Insert content here>' }],
        },
      ]),
    }
  }
}
