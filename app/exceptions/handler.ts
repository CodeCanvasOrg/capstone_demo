import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. You might want to enable them in production only, but feel
   * free to enable them in development as well.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Status pages is a collection of error code range and a callback
   * to return the HTML contents to send as a response.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (_, { inertia }) => inertia.render('errors/not_found', {}),
    '500..599': (_, { inertia }) => inertia.render('errors/server_error', {}),
  }

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    const failure = error as {
      status?: number
      code?: string
      message?: string
      messages?: { field: string; message: string }[]
    }
    const status = typeof failure.status === 'number' ? failure.status : 500
    if (ctx.request.accepts(['html', 'json']) === 'json') {
      return ctx.response.status(status).send({
        error: {
          code: status >= 500 ? 'E_REQUEST_FAILED' : (failure.code ?? `E_HTTP_${status}`),
          message:
            status >= 500
              ? 'The request could not finish. Please try again.'
              : (failure.message ?? 'The request was rejected.'),
          retryable: status >= 500,
        },
        ...(status === 422 && Array.isArray(failure.messages)
          ? { errors: failure.messages.map(({ field, message }) => ({ field, message })) }
          : {}),
      })
    }
    if (status === 409 && ctx.request.header('X-Inertia')) {
      ctx.session.flash(
        'error',
        failure.message ?? 'This item changed. Reload its latest state before retrying.'
      )
      return ctx.response.redirect().back()
    }
    if ([403, 404, 410].includes(status)) {
      ctx.response.status(status)
      return ctx.inertia.render('errors/access_problem', { status })
    }
    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
