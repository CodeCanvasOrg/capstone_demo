import { fileValidator } from '#validators/upload'
import drive from '@adonisjs/drive/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export default class UploadsController {
  async handle({ request, auth, response }: HttpContext) {
    const { file } = await request.validateUsing(fileValidator)

    if (!file.tmpPath) {
      return response.badRequest({ message: 'File could not be processed' })
    }

    const filetype = path.extname(file.clientName).toLowerCase()
    const key = `uploads/${auth.user?.id ?? '1'}/${crypto.randomUUID()}${filetype}`
    const contents = await readFile(file.tmpPath)

    await drive.use().put(key, contents)
    const objectUrl = await drive.use().getUrl(key)

    return response.ok({
      filename: file.clientName,
      filetype,
      objectKey: key,
      objectUrl,
    })
  }
}
