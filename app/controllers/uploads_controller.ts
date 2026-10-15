import type { HttpContext } from '@adonisjs/core/http'
import { readFile } from 'node:fs/promises'

import UploadService from '#services/upload_service'
import { fileValidator } from '#validators/upload'

export default class UploadsController {
  async handle({ request, workspaceAccess, response }: HttpContext) {
    const { file } = await request.validateUsing(fileValidator)

    if (!file.tmpPath) {
      return response.badRequest({ message: 'File could not be processed' })
    }

    const uploaded = await new UploadService().upload(workspaceAccess!, {
      filename: file.clientName,
      contents: await readFile(file.tmpPath),
    })

    return response.ok(uploaded)
  }
}
