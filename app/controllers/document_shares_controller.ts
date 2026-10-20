import type { HttpContext } from '@adonisjs/core/http'
export default class DocumentSharesController {
  async index({ response }: HttpContext) {
    return response.redirect().toRoute('home')
  }
  async store({ response }: HttpContext) {
    return response
      .status(410)
      .send({ message: 'Document sharing has been replaced by workspace membership' })
  }
  async update(ctx: HttpContext) {
    return this.store(ctx)
  }
  async destroy(ctx: HttpContext) {
    return this.store(ctx)
  }
}
