/**
 * Whether a model accepts pictures, read from OpenRouter's model list (`GET /models`). A model the
 * list does not name, or an entry without modalities, is treated as text only.
 */
export function modelAcceptsImages(list: unknown, id: string): boolean {
  const data = (list as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return false
  const entry = data.find((m) => (m as { id?: unknown })?.id === id) as
    { architecture?: { input_modalities?: unknown; modality?: unknown } } | undefined
  const modalities = entry?.architecture?.input_modalities
  if (Array.isArray(modalities)) return modalities.includes('image')
  const modality = entry?.architecture?.modality
  return typeof modality === 'string' && modality.split('->')[0].split('+').includes('image')
}
