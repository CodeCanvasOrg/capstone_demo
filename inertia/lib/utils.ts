export { cn } from 'cn'
export const NODE_HANDLES_SELECTED_STYLE_CLASSNAME = 'node-handles-selected-style'

export function duplicateContent<T>(content: T): T {
  return structuredClone(content)
}

export function isValidUrl(url: string) {
  return /^https?:\/\/\S+$/.test(url)
}
