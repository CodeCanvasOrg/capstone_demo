import { Exception } from '@adonisjs/core/exceptions'
import LayoutPreset from '#models/layout_preset'
import {
  missingResource,
  uuid,
  type WorkspaceAccessContext,
} from '#services/workspaces/access_service'
import { pinLayout } from '#services/layout/layout_validation'

const taken = () =>
  new Exception('A preset with this name already exists in the workspace.', {
    status: 422,
    code: 'E_PRESET_NAME_TAKEN',
  })

const cleanName = (value: string) => {
  const name = value.trim()
  if (!name || name.length > 80)
    throw new Exception('Preset names must be 1 to 80 characters.', {
      status: 422,
      code: 'E_LAYOUT_INVALID',
    })
  return name
}

/**
 * Workspace presets: a name plus pinned template and brand versions and
 * allowed options. They hold configuration only, never content. Every query is
 * scoped to the caller's workspace, so another workspace's id is simply absent.
 * Who may publish shared presets is an open decision (D-BRAND); for now any
 * active member of the workspace can manage them.
 */
export default class LayoutPresetService {
  list(context: WorkspaceAccessContext) {
    return LayoutPreset.query().where('workspaceId', context.workspaceId).orderBy('name')
  }

  private find(context: WorkspaceAccessContext, id: string) {
    if (!uuid(id)) throw missingResource()
    return LayoutPreset.query().where({ id, workspaceId: context.workspaceId }).firstOrFail()
  }

  private async assertFree(context: WorkspaceAccessContext, name: string, exceptId?: string) {
    const query = LayoutPreset.query()
      .where('workspaceId', context.workspaceId)
      .whereRaw('lower(name) = lower(?)', [name])
    if (exceptId) query.whereNot('id', exceptId)
    if (await query.first()) throw taken()
  }

  async create(
    context: WorkspaceAccessContext,
    input: {
      name: string
      templateId: string
      templateVersion?: number
      brandVersion?: number
      options?: unknown
    }
  ) {
    const pinned = pinLayout(input)
    const name = cleanName(input.name)
    await this.assertFree(context, name)
    return LayoutPreset.create({
      workspaceId: context.workspaceId,
      name,
      createdBy: context.actorId,
      ...pinned,
    })
  }

  async update(
    context: WorkspaceAccessContext,
    id: string,
    input: {
      name?: string
      templateId?: string
      templateVersion?: number
      brandVersion?: number
      options?: unknown
    }
  ) {
    const preset = await this.find(context, id)
    if (input.name !== undefined) {
      const name = cleanName(input.name)
      await this.assertFree(context, name, preset.id)
      preset.name = name
    }
    if (
      input.templateId !== undefined ||
      input.options !== undefined ||
      input.brandVersion !== undefined
    ) {
      const pinned = pinLayout({
        templateId: input.templateId ?? preset.templateId,
        // A new template id means "its latest"; otherwise keep the pinned version.
        templateVersion: input.templateId
          ? input.templateVersion
          : (input.templateVersion ?? preset.templateVersion),
        brandId: preset.brandId,
        brandVersion: input.brandVersion ?? preset.brandVersion,
        options: input.options ?? preset.options,
      })
      preset.merge(pinned)
    }
    return preset.save()
  }

  async duplicate(context: WorkspaceAccessContext, id: string, name: string) {
    const source = await this.find(context, id)
    const copy = cleanName(name)
    await this.assertFree(context, copy)
    return LayoutPreset.create({
      workspaceId: context.workspaceId,
      name: copy,
      createdBy: context.actorId,
      templateId: source.templateId,
      templateVersion: source.templateVersion,
      brandId: source.brandId,
      brandVersion: source.brandVersion,
      options: source.options,
    })
  }

  /** Documents that applied the preset keep their pinned selection (presetId is set null by the FK). */
  async remove(context: WorkspaceAccessContext, id: string) {
    const preset = await this.find(context, id)
    await preset.delete()
  }
}
