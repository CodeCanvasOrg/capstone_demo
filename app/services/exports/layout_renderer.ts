import { readFile } from 'node:fs/promises'
import type { BrandKit } from '../../../shared/layout/brand.ts'
import type { LayoutPlan, PlanBlock } from '../../../shared/layout/plan.ts'
import { esc, renderBlocks } from '#services/exports/client_blocks'

/**
 * Template layout renderer (RND-01). One render path serves preview and final
 * output: the only intentional difference is the draft banner. Input is a
 * layout plan, which only ever contains client-safe content, and brand tokens.
 * Sizes live in the stylesheet keyed by block id, so density changes spacing
 * and type size but never the text.
 */
export const PAGE_MARGIN_MM = 16
export const RENDERER_VERSION = 'layout-1'

const fontCache = new Map<string, string>()

/** Static woff2 files, embedded as data so no render ever fetches a font. */
async function fontFaces(brand: BrandKit) {
  const faces = await Promise.all(
    brand.fonts.map(async (font) => {
      let data = fontCache.get(font.file)
      if (!data) {
        const bytes = await readFile(new URL(import.meta.resolve(font.file)))
        data = bytes.toString('base64')
        fontCache.set(font.file, data)
      }
      return `@font-face{font-family:"${font.family}";font-style:normal;font-weight:${font.weight};font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2");}`
    })
  )
  return faces.join('')
}

const css = (plan: LayoutPlan, brand: BrandKit) => {
  const palette = brand.palette
  const sizes = plan.blocks
    .map((item) => {
      switch (item.type) {
        case 'hero':
          return `#${item.id} h1{font-size:${item.fontPt}pt}#${item.id} .summary{font-size:${(item.fontPt * 0.55).toFixed(1)}pt}`
        case 'results':
          return `#${item.id} .stat-value{font-size:${item.fontPt}pt}`
        case 'text':
        case 'cta':
          return `#${item.id}{font-size:${item.fontPt}pt}`
        case 'sources':
          return `#${item.id}{font-size:${item.fontPt}pt}`
        case 'figure':
          return `#${item.id} figcaption{font-size:${item.fontPt}pt}`
      }
    })
    .join('')
  const gap = plan.density === 'compact' ? 8 : 12
  return `
@page{size:A4;margin:${PAGE_MARGIN_MM}mm}
*{box-sizing:border-box}
body{margin:0;font-family:${brand.fonts[0]?.family ?? 'Arial'},Arial,sans-serif;color:${palette.text};background:${palette.background};line-height:${plan.density === 'compact' ? 1.45 : 1.55};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.draft-banner{margin:0 0 10pt;padding-bottom:6pt;border-bottom:2px solid ${palette.accent};font-size:9pt;font-weight:700;color:${palette.muted}}
.brandbar{display:flex;align-items:center;gap:8pt;border-top:6px solid ${palette.accent};padding-top:8pt;margin-bottom:${gap}pt;color:${palette.primary};font-weight:800;font-size:10pt;letter-spacing:.02em}
.hero{margin-bottom:${gap + 4}pt}
.hero h1{margin:0 0 6pt;line-height:1.15;color:${palette.primary};font-weight:800;overflow-wrap:anywhere}
.hero .summary{color:${palette.muted};font-weight:400}
.hero .summary p{margin:0}
.stat-row{display:flex;flex-wrap:wrap;gap:${gap}pt;margin:0 0 ${gap + 2}pt;padding:${gap}pt;background:${palette.surface};border-left:4px solid ${palette.accent};break-inside:avoid}
.stat{flex:1 1 30%;min-width:110pt;break-inside:avoid}
.stat-prefix{display:block;font-size:8pt;font-weight:600;color:${palette.muted};text-transform:uppercase;letter-spacing:.04em}
.stat-value{display:block;font-weight:800;color:${palette.primary};line-height:1.1}
.stat-label{display:inline-block;margin-top:2pt;font-size:8pt;font-weight:700;color:${palette.primary};text-transform:uppercase;letter-spacing:.05em}
.stat-context{display:block;font-size:8.5pt;color:${palette.muted};line-height:1.3}
h2,h3{break-after:avoid;color:${palette.primary};font-weight:700}
h2{font-size:1.25em;margin:${gap + 4}pt 0 4pt;padding-bottom:3pt;border-bottom:1px solid ${palette.surface}}
h3{font-size:1.1em;margin:${gap}pt 0 3pt}
p{margin:0 0 ${gap - 2}pt}
ul,ol{margin:0 0 ${gap - 2}pt;padding-left:18pt}
li{break-inside:avoid}
blockquote{margin:0 0 ${gap - 2}pt;padding-left:10pt;border-left:3px solid ${palette.accent};color:${palette.muted}}
sup.ref{font-size:7pt;line-height:0;color:${palette.muted};margin-left:1px}
sup.ref + sup.ref::before{content:","}
figure{margin:${gap}pt 0;break-inside:avoid}
figure img{display:block;max-width:100%;max-height:230pt;object-fit:contain;margin:0 auto}
figcaption{margin-top:3pt;color:${palette.muted};text-align:center}
.cta{margin:${gap}pt 0;break-inside:avoid}
.cta a{display:inline-block;padding:6pt 14pt;background:${palette.primary};color:${palette.accent};font-weight:700;text-decoration:none;border-radius:2pt}
.sources{margin-top:${gap + 4}pt;padding-top:6pt;border-top:1px solid ${palette.surface};color:${palette.muted};break-inside:avoid}
.sources h2{font-size:1.1em;border:0;margin:0 0 3pt}
.sources ol{margin:0;padding-left:16pt}
a{color:inherit}
${sizes}`
}

const stat = (item: Extract<PlanBlock, { type: 'results' }>['items'][number]) =>
  `<div class="stat">${item.prefix ? `<span class="stat-prefix">${esc(item.prefix)}</span>` : ''}<span class="stat-value">${esc(item.value)}</span><span class="stat-label">${esc(item.label)}</span>${item.context ? `<span class="stat-context">${esc(item.context)}</span>` : ''}</div>`

function block(item: PlanBlock): string {
  switch (item.type) {
    case 'hero':
      return `<header class="hero" id="${item.id}">${item.title ? `<h1>${esc(item.title)}</h1>` : ''}${item.summary ? `<div class="summary">${renderBlocks([item.summary])}</div>` : ''}</header>`
    case 'results':
      return `<section class="stat-row" id="${item.id}">${item.items.map(stat).join('')}</section>`
    case 'text':
      return `<section class="text" id="${item.id}">${item.heading ? `<h2>${esc(item.heading)}</h2>` : ''}${renderBlocks(item.blocks)}</section>`
    case 'figure': {
      const { src, alt } = item.image
      return `<figure class="figure" id="${item.id}"><img src="${esc(src)}" alt="${esc(alt ?? '')}" />${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ''}</figure>`
    }
    case 'cta':
      return `<p class="cta" id="${item.id}"><a href="${esc(item.href)}">${esc(item.label)}</a></p>`
    case 'sources':
      return `<section class="sources" id="${item.id}"><h2>Sources</h2><ol>${item.items
        .map(
          (source) =>
            `<li value="${source.number}">${esc(source.label)}${source.page ? `, p. ${source.page}` : ''}</li>`
        )
        .join('')}</ol></section>`
  }
}

export async function renderLayoutHtml(
  plan: LayoutPlan,
  brand: BrandKit,
  { preview = false }: { preview?: boolean } = {}
) {
  const wordmark =
    brand.logo?.kind === 'text' ? `<div class="brandbar">${esc(brand.name)}</div>` : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>${await fontFaces(brand)}${css(plan, brand)}</style>
</head>
<body>
<article data-template="${esc(plan.template.id)}" data-template-version="${plan.template.version}" data-brand="${esc(brand.id)}@${brand.version}" data-variant="${plan.variant}" data-density="${plan.density}">
${preview ? '<p class="draft-banner">PREVIEW · NOT APPROVED FOR FINAL EXPORT</p>' : ''}${wordmark}
${plan.blocks.map(block).join('\n')}
</article>
</body>
</html>`
}
