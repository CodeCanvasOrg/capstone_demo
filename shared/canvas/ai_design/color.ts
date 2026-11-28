/** WCAG 2.x colour maths for the design checks. Browser-safe. */

export type Rgb = [number, number, number]

export function toRgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16)) as Rgb
}

export const toHex = (rgb: Rgb) =>
  `#${rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`

const channel = (c: number) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** Relative luminance, 0 to 1. */
export const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Contrast ratio of two colours, 1 to 21. */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** `top` laid over `bottom` at `alpha` percent (100 is opaque). */
export function blend(top: string, bottom: string, alpha = 100): string {
  const a = Math.min(Math.max(alpha, 0), 100) / 100
  const t = toRgb(top)
  const b = toRgb(bottom)
  return toHex([0, 1, 2].map((i) => t[i] * a + b[i] * (1 - a)) as Rgb)
}

/** AA: 4.5 for text, 3 for large text (18 pt, or 14 pt bold). */
export const requiredContrast = (sizePt: number, weight: number) =>
  sizePt >= 18 || (sizePt >= 14 && weight >= 700) ? 3 : 4.5

/** The first of `preferred` that reads on `background`, else the better of black and white. */
export function readable(preferred: readonly string[], background: string, ratio = 4.5) {
  for (const color of preferred) if (contrast(color, background) >= ratio) return color
  return contrast('#000000', background) >= contrast('#ffffff', background) ? '#000000' : '#ffffff'
}
