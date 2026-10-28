import { Exception } from '@adonisjs/core/exceptions'

export default class ModelImageException extends Exception {
  constructor() {
    super(
      'A source image could not be prepared for generation. Use a smaller PNG, JPEG, or WebP image, or choose no images and try again.',
      { status: 422, code: 'E_MODEL_IMAGE' }
    )
  }
}
