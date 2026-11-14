import type { HttpContext } from '@adonisjs/core/http'
import LayoutPresetService from '#services/layout/layout_preset_service'
import {
  presetCreateValidator,
  presetDuplicateValidator,
  presetUpdateValidator,
} from '#validators/layout'

const view = (preset: Awaited<ReturnType<LayoutPresetService['create']>>) => ({
  id: preset.id,
  name: preset.name,
  templateId: preset.templateId,
  templateVersion: preset.templateVersion,
  brandId: preset.brandId,
  brandVersion: preset.brandVersion,
  options: preset.options,
})

export default class LayoutPresetsController {
  async index({ workspaceAccess, response }: HttpContext) {
    const presets = await new LayoutPresetService().list(workspaceAccess!)
    return response.ok({ data: presets.map(view) })
  }

  async store({ workspaceAccess, request, response }: HttpContext) {
    const preset = await new LayoutPresetService().create(
      workspaceAccess!,
      await request.validateUsing(presetCreateValidator)
    )
    return response.created({ data: view(preset) })
  }

  async update({ workspaceAccess, params, request, response }: HttpContext) {
    const preset = await new LayoutPresetService().update(
      workspaceAccess!,
      params.presetId,
      await request.validateUsing(presetUpdateValidator)
    )
    return response.ok({ data: view(preset) })
  }

  async duplicate({ workspaceAccess, params, request, response }: HttpContext) {
    const { name } = await request.validateUsing(presetDuplicateValidator)
    const preset = await new LayoutPresetService().duplicate(
      workspaceAccess!,
      params.presetId,
      name
    )
    return response.created({ data: view(preset) })
  }

  async destroy({ workspaceAccess, params, response }: HttpContext) {
    await new LayoutPresetService().remove(workspaceAccess!, params.presetId)
    return response.ok({ data: { deleted: true } })
  }
}
