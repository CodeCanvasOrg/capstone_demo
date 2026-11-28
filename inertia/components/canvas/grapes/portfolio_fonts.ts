/**
 * The portfolio template's fonts for the editor canvas, which is an iframe and cannot see the page's
 * own @font-face rules. The files are the same static Inter instances the export embeds
 * (public/fonts/portfolio), served as static assets.
 */
const FILES = [
  ['Inter', 400, 'Inter-400-14.ttf'],
  ['Inter', 600, 'Inter-600-14.ttf'],
  ['Inter', 700, 'Inter-700-14.ttf'],
  ['Inter Display', 700, 'Inter-700-32.ttf'],
] as const

export const portfolioFontCss = () =>
  FILES.map(
    ([family, weight, file]) =>
      `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:block;src:url("${location.origin}/fonts/portfolio/${file}") format("truetype")}`
  ).join('')
