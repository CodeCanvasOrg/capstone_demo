import { fileValidator } from '#validators/upload'
import drive from '@adonisjs/drive/services/main'
import type { HttpContext } from '@adonisjs/core/http'

export default class UploadsController {
  async handle({ request, auth, response }: HttpContext) {
    const { file } = await request.validateUsing(fileValidator)

    const key = `uploads/${auth.user?.id ?? '1'}/${crypto.randomUUID()}-${file.clientName}`

    await file.moveToDisk(key)

    const url = drive.use().getUrl(key)

    return response.ok({
      name: file.clientName,
      key,
      url,
    })
  }
}
