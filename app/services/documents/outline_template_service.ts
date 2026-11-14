import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import AccessService, {
  missingResource,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import { fingerprint } from '#services/workspaces/task_service'
import type { TipTapDocument } from '#services/documents/chunk_metadata_service'
import type { EntryFormat } from '../../../shared/layout/formats.ts'
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
    description: 'A public-facing page: the challenge, the solution, what was built and impact.',
  },
  technical: {
    name: 'Technical portfolio entry',
    description: 'The approach, an architecture pipeline, implementation and an evaluation table.',
  },
  vision: {
    name: 'Product vision',
    description: 'The user need, the experience, capabilities by availability and a roadmap.',
  },
} as const

export default class OutlineTemplateService {
  async list(context: WorkspaceAccessContext): Promise<OutlineTemplate[]> {
    await new AccessService().resolve(context.actorId, context.workspaceId)
    return Promise.all(TEMPLATE_IDS.map((id) => this.resolve(id)))
  }
  /**
   * `legacy` returns the older free-section outline for the portfolio, technical
   * and vision templates, for documents converted from the previous template
   * system and for deployments that opt back with GENERATION_FORMAT=legacy.
   */
  async resolve(
    id: string,
    { legacy = false }: { legacy?: boolean } = {}
  ): Promise<OutlineTemplate> {
    if (!TEMPLATE_IDS.includes(id as (typeof TEMPLATE_IDS)[number])) throw missingResource()
    const structured = id === BRANDED_TEMPLATE_ID || !legacy
    const instructions = await readFile(
      app.makePath(
        `resources/document_templates/${structured && id !== BRANDED_TEMPLATE_ID ? `${id}_entry` : id}.md`
      ),
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
      ...(structured ? { format: 'branded_entry' as const, entryFormat: id as EntryFormat } : {}),
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
