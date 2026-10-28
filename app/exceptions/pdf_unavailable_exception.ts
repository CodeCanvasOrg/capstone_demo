import { Exception } from '@adonisjs/core/exceptions'
export default class PdfUnavailableException extends Exception {
  constructor() {
    super(
      'The PDF renderer could not start in this environment. Open document preview and use your browser’s Print → Save as PDF, or run the server in an environment that permits Chromium.',
      { status: 503, code: 'E_PDF_UNAVAILABLE' }
    )
  }
}
