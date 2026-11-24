import { useEffect, useState, useSyncExternalStore } from 'react'
import { urlFor } from '@/client'
import { api, ApiError, feedbackError } from '@/lib/api'

/** An image uploaded to the document, as the server lists it. */
export type DocumentImageInfo = {
  id: string
  filename: string
  mime: string
  byteSize: number
  width: number | null
  height: number | null
  caption?: string | null
  altText?: string | null
  /** Focal point found at upload, percent of width and height. */
  focus?: { x: number; y: number } | null
  origin?: 'upload' | 'source'
  src: string
}

type Params = { workspaceId: string; documentId: string }

/** The same types and size the server accepts (DocumentImageService.mime). */
export const IMAGE_TYPES = ['image/png', 'image/jpeg'] as const
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024

/** Why a file cannot be uploaded, or null when it can. Checked again on the server. */
export function imageFileProblem(file: File): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'Choose a PNG or JPEG image'
  if (file.size > IMAGE_MAX_BYTES) return 'Choose an image up to 10 MB'
  return null
}

/**
 * The document's images, shared by every part of the editor: an image dropped
 * on the canvas shows up in the library straight away.
 */
const store = new Map<string, DocumentImageInfo[]>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function remember(documentId: string, images: DocumentImageInfo[]) {
  const seen = new Set<string>()
  store.set(
    documentId,
    images.filter((image) => !seen.has(image.id) && seen.add(image.id))
  )
  emit()
}

export async function uploadImage(params: Params, file: File): Promise<DocumentImageInfo> {
  const problem = imageFileProblem(file)
  if (problem) throw new ApiError(problem, 422)
  const data = new FormData()
  data.append('file', file)
  const res = await api<{ data: DocumentImageInfo }>(
    urlFor('documentImages.store', params),
    'POST',
    data
  )
  remember(params.documentId, [res.data, ...(store.get(params.documentId) ?? [])])
  return res.data
}

/** Saves the caption and alt text of a picture, and keeps the shared list in step. */
export async function saveImageText(
  params: Params,
  imageId: string,
  patch: { caption?: string | null; altText?: string | null }
): Promise<DocumentImageInfo> {
  const res = await api<{ data: DocumentImageInfo }>(
    urlFor('documentImages.update', { ...params, imageId }),
    'PATCH',
    patch
  )
  remember(
    params.documentId,
    (store.get(params.documentId) ?? []).map((image) => (image.id === imageId ? res.data : image))
  )
  return res.data
}

/** Looks an image up in what has been loaded; null if not (yet) known. */
export const knownImage = (documentId: string, imageId: string | null) =>
  (imageId && store.get(documentId)?.find((image) => image.id === imageId)) || null

/** Loads the document's images once, then follows uploads. */
export function useDocumentImages({ workspaceId, documentId }: Params) {
  const images = useSyncExternalStore(
    subscribe,
    () => store.get(documentId),
    () => undefined
  )
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (store.has(documentId)) return
    let cancelled = false
    api<{ data: DocumentImageInfo[] }>(urlFor('documentImages.index', { workspaceId, documentId }))
      .then((res) => {
        // Keep anything uploaded while the list was loading.
        if (!cancelled) remember(documentId, [...(store.get(documentId) ?? []), ...res.data])
      })
      .catch((err) => !cancelled && setError(feedbackError(err).message))
    return () => {
      cancelled = true
    }
  }, [workspaceId, documentId])
  return { images: images ?? [], loading: !images && !error, error }
}
