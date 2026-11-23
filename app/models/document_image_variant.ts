import { DocumentImageVariantSchema } from '#database/schema'

export type ImageVariantPurpose = 'thumb' | 'screen' | 'print'

/** A resized copy of a document image: thumb for the library, screen for the editor, print for exports. */
export default class DocumentImageVariant extends DocumentImageVariantSchema {
  declare purpose: ImageVariantPurpose
  declare format: 'webp' | 'jpeg' | 'png'
}
