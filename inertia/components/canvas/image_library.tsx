import { Check, ImageOff, LoaderCircle, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { feedbackError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { IMAGE_TYPES, uploadImage, useDocumentImages, type DocumentImageInfo } from './images'

/**
 * The document's images as a grid of thumbnails: choose one for the selected
 * image box, or upload a new one (it is chosen straight away). Only images of
 * this document are offered, as the canvas accepts no other.
 */
export function ImageLibrary({
  workspaceId,
  documentId,
  selectedId,
  onPick,
}: {
  workspaceId: string
  documentId: string
  selectedId: string | null
  onPick: (image: DocumentImageInfo) => void
}) {
  const { images, loading, error } = useDocumentImages({ workspaceId, documentId })
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setBusy(true)
    setUploadError(null)
    try {
      onPick(await uploadImage({ workspaceId, documentId }, file))
    } catch (err) {
      setUploadError(feedbackError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        className="hidden"
        data-testid="canvas-image-input"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
          event.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <Upload aria-hidden="true" />
        )}
        {selectedId ? 'Upload a new image' : 'Upload image'}
      </Button>
      {uploadError && (
        <p role="alert" className="text-xs text-destructive">
          {uploadError}
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> Loading images…
        </p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : images.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageOff aria-hidden="true" className="size-3.5" /> No images yet. Upload one, or drop an
          image file on a page.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5" aria-label="Document images">
          {images.map((image) => {
            const selected = image.id === selectedId
            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => onPick(image)}
                  aria-pressed={selected}
                  title={image.filename}
                  className={`relative block aspect-square w-full overflow-hidden rounded-md border bg-muted outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${selected ? 'ring-2 ring-primary' : 'hover:border-foreground/40'}`}
                >
                  <img
                    src={image.src}
                    alt={image.filename}
                    loading="lazy"
                    draggable={false}
                    className="size-full object-cover"
                  />
                  {selected && (
                    <span className="absolute top-1 right-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                      <Check aria-hidden="true" className="size-3" />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
