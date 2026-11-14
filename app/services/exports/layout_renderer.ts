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

const M = PAGE_MARGIN_MM

const css = (plan: LayoutPlan, brand: BrandKit) => {
  const palette = brand.palette
  const sizes = plan.blocks
    .map((item) => {
      switch (item.type) {
        case 'hero':
          return `#${item.id} h1{font-size:${item.fontPt}pt}#${item.id} .summary{font-size:${(item.fontPt * 0.52).toFixed(1)}pt}`
        case 'results':
          return `#${item.id} .stat-value{font-size:${item.fontPt}pt}`
        case 'figure':
          return `#${item.id} figcaption{font-size:${item.fontPt}pt}`
        default:
          return `#${item.id}{font-size:${item.fontPt}pt}`
      }
    })
    .join('')
  const compact = plan.density === 'compact'
  const gap = compact ? 8 : 12
  return `
@page{size:A4;margin:${M}mm}
@page:first{margin-top:0}
*{box-sizing:border-box}
body{margin:0;font-family:${brand.fonts[0]?.family ?? 'Arial'},Arial,sans-serif;color:${palette.text};background:${palette.background};line-height:${compact ? 1.4 : 1.5};-webkit-print-color-adjust:exact;print-color-adjust:exact}
article{position:relative}
.draft-banner{position:absolute;top:4mm;right:-${M - 4}mm;margin:0;padding:3pt 8pt;background:#b42318;color:#fff;font-size:7pt;font-weight:800;letter-spacing:.06em;z-index:2}
.hero{display:grid;grid-template-columns:1fr;gap:0 8mm;margin:0 -${M}mm 0;padding:${M - 6}mm ${M}mm ${M - 6}mm;background:${palette.primary};color:#fff;break-inside:avoid}
.hero.has-figure{grid-template-columns:1fr 60mm;align-items:center}
.hero-text{min-width:0}
.brandbar{display:flex;align-items:center;gap:6pt;margin-bottom:${gap}pt;font-weight:700;font-size:10pt;color:#fff}
.hex{display:inline-block;width:13pt;height:15pt;background:${palette.accent};clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.kicker{margin:0 0 5pt;font-size:7.5pt;font-weight:800;letter-spacing:.12em;color:${palette.accent}}
.hero h1{margin:0 0 7pt;line-height:1.12;color:#fff;font-weight:800;overflow-wrap:anywhere}
.hero .summary{color:#d5dbe6;font-weight:400}
.hero .summary p{margin:0}
.hero-figure{margin:0;padding:6pt;background:#fff;border-radius:6pt;break-inside:avoid}
.hero-figure img{display:block;width:100%;max-height:150pt;object-fit:contain}
.stat-band{display:flex;gap:${gap}pt;margin:0 -${M}mm ${gap + 6}pt;padding:${M - 8}mm ${M}mm;background:${palette.accent};color:${palette.primary};break-inside:avoid}
.stat{flex:1 1 0;min-width:0;break-inside:avoid}
.stat-value{display:block;font-weight:800;line-height:1.05;color:${palette.primary}}
.mark{font-size:.45em;font-weight:700;margin-left:1px;vertical-align:super;line-height:0}
.stat-units{display:block;margin-top:3pt;font-size:9.5pt;font-weight:500;line-height:1.3}
.tag{display:inline-block;margin-top:5pt;padding:1.5pt 7pt;border:1px solid ${palette.primary};border-radius:99pt;font-size:6.5pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.stat-context{display:block;margin-top:3pt;font-size:8pt;line-height:1.3}
h2,h3{break-after:avoid;color:${palette.primary};font-weight:700}
h2{font-size:1.2em;margin:${gap + 2}pt 0 4pt;padding-bottom:3pt;border-bottom:1px solid ${palette.surface}}
h3{font-size:1.1em;margin:${gap}pt 0 3pt}
.columns{display:grid;grid-template-columns:1fr 1fr;gap:0 10mm;margin-bottom:${gap}pt;break-inside:avoid}
.columns h2{margin:0 0 4pt;padding:0;border:0;font-size:7.5pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${palette.accentText}}
.columns p{margin:0 0 6pt}
p{margin:0 0 ${gap - 2}pt}
ul,ol{margin:0 0 ${gap - 2}pt;padding-left:18pt}
li{break-inside:avoid}
blockquote{margin:0 0 ${gap - 2}pt;padding-left:10pt;border-left:3px solid ${palette.accent};color:${palette.muted}}
sup.ref{font-size:7pt;line-height:0;color:${palette.muted};margin-left:1px}
sup.ref + sup.ref::before{content:","}
.steps{display:grid;grid-template-columns:repeat(var(--n,4),1fr);gap:0 ${gap}pt;margin:${gap}pt 0;padding-top:${gap - 4}pt;border-top:3px solid ${palette.primary};break-inside:avoid}
.step{min-width:0}
.step-n{display:block;font-size:1.5em;font-weight:800;color:${palette.accentText}}
.step-title{display:block;margin:2pt 0;font-weight:700;color:${palette.primary}}
.step-text{display:block;color:${palette.muted};font-size:.92em;line-height:1.35}
.cards{display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:${gap - 2}pt;margin:${gap}pt 0;break-inside:avoid}
.card{padding:${gap - 2}pt ${gap}pt;background:${palette.surface};border-radius:5pt;break-inside:avoid}
.card-title{display:block;margin-bottom:3pt;font-weight:700;color:${palette.primary}}
.card-text{display:block;color:${palette.muted};font-size:.92em;line-height:1.35}
.roadmap{display:flex;gap:${gap}pt;margin:${gap}pt 0;padding:${gap - 2}pt ${gap}pt;border:1px dashed ${palette.muted};border-radius:5pt;break-inside:avoid}
.roadmap-label{flex:none;font-size:7.5pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${palette.primary}}
figure{margin:${gap}pt 0;break-inside:avoid}
figure img{display:block;max-width:100%;max-height:230pt;object-fit:contain;margin:0 auto}
figcaption{margin-top:3pt;color:${palette.muted};text-align:center}
.cta{display:flex;align-items:center;justify-content:space-between;gap:${gap}pt;margin:${gap + 2}pt 0;padding:${gap}pt ${gap + 4}pt;background:${palette.primary};border-radius:6pt;break-inside:avoid}
.cta-headline{font-weight:700;color:#fff}
.cta a{flex:none;margin-left:auto;padding:5pt 13pt;background:${palette.accent};color:${palette.primary};font-weight:800;text-decoration:none;border-radius:99pt}
.sources{margin-top:${gap + 2}pt;padding-top:5pt;border-top:1px solid ${palette.surface};color:${palette.muted};line-height:1.35;break-inside:avoid}
.sources .note{display:block;margin-bottom:1pt}
.sources ol{display:flex;flex-wrap:wrap;gap:0 10pt;margin:2pt 0 0;padding:0;list-style:none}
.sources li{counter-increment:src}
.sources li::before{content:attr(value) ". "}
a{color:inherit}
${sizes}`
}

const stat = (item: Extract<PlanBlock, { type: 'results' }>['items'][number]) =>
  `<div class="stat"><span class="stat-value">${item.prefix ? `${esc(item.prefix)} ` : ''}${esc(item.value)}${item.marker ? `<sup class="mark">${esc(item.marker)}</sup>` : ''}</span>${item.units ? `<span class="stat-units">${esc(item.units)}</span>` : ''}<span class="tag">${esc(item.label)}</span>${item.context ? `<span class="stat-context">${esc(item.context)}</span>` : ''}</div>`

const section = (value: { heading?: string; blocks: Parameters<typeof renderBlocks>[0] }) =>
  `<div>${value.heading ? `<h2>${esc(value.heading)}</h2>` : ''}${renderBlocks(value.blocks)}</div>`

function block(item: PlanBlock, brand: BrandKit): string {
  switch (item.type) {
    case 'hero': {
      const wordmark =
        brand.logo?.kind === 'text'
          ? `<div class="brandbar"><span class="hex"></span>${esc(brand.name)}</div>`
          : ''
      const figure = item.figure
        ? `<figure class="hero-figure"><img src="${esc(item.figure.src)}" alt="${esc(item.figure.alt ?? '')}" /></figure>`
        : ''
      return `<header class="hero${item.figure ? ' has-figure' : ''}" id="${item.id}"><div class="hero-text">${wordmark}<p class="kicker">${esc(item.kicker)}</p>${item.title ? `<h1>${esc(item.title)}</h1>` : ''}${item.summary ? `<div class="summary">${renderBlocks([item.summary])}</div>` : ''}</div>${figure}</header>`
    }
    case 'results':
      return `<section class="stat-band" id="${item.id}">${item.items.map(stat).join('')}</section>`
    case 'columns':
      return `<section class="columns" id="${item.id}">${section(item.left)}${section(item.right)}</section>`
    case 'text':
      return `<section class="text" id="${item.id}">${item.heading ? `<h2>${esc(item.heading)}</h2>` : ''}${renderBlocks(item.blocks)}</section>`
    case 'steps':
      return `<section class="steps" id="${item.id}" style="--n:${item.items.length}">${item.items
        .map(
          (step) =>
            `<div class="step"><span class="step-n">${step.n}</span><span class="step-title">${esc(step.title)}</span>${step.text ? `<span class="step-text">${esc(step.text)}</span>` : ''}</div>`
        )
        .join('')}</section>`
    case 'capabilities':
      return `<section class="cards" id="${item.id}" style="--n:${item.items.length}">${item.items
        .map(
          (card) =>
            `<div class="card"><span class="card-title">${esc(card.title)}</span>${card.text ? `<span class="card-text">${esc(card.text)}</span>` : ''}</div>`
        )
        .join('')}</section>`
    case 'roadmap':
      return `<div class="roadmap" id="${item.id}"><span class="roadmap-label">Roadmap</span><span>${esc(item.text)}</span></div>`
    case 'figure': {
      const { src, alt } = item.image
      return `<figure class="figure" id="${item.id}"><img src="${esc(src)}" alt="${esc(alt ?? '')}" />${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ''}</figure>`
    }
    case 'cta':
      return `<div class="cta" id="${item.id}">${item.headline ? `<span class="cta-headline">${esc(item.headline)}</span>` : ''}<a href="${esc(item.href)}">${esc(item.label)}</a></div>`
    case 'sources':
      return `<section class="sources" id="${item.id}">${item.notes
        .map((note) => `<span class="note">${esc(note.marker)}. ${esc(note.text)}</span>`)
        .join('')}${
        item.items.length
          ? `<ol>${item.items
              .map(
                (source) =>
                  `<li value="${source.number}">${esc(source.label)}${source.page ? `, p. ${source.page}` : ''}</li>`
              )
              .join('')}</ol>`
          : ''
      }</section>`
  }
}

export async function renderLayoutHtml(
  plan: LayoutPlan,
  brand: BrandKit,
  { preview = false }: { preview?: boolean } = {}
) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>${await fontFaces(brand)}${css(plan, brand)}</style>
</head>
<body>
<article data-template="${esc(plan.template.id)}" data-template-version="${plan.template.version}" data-brand="${esc(brand.id)}@${brand.version}" data-variant="${plan.variant}" data-density="${plan.density}">
${preview ? '<p class="draft-banner">PREVIEW · NOT APPROVED FOR FINAL EXPORT</p>' : ''}
${plan.blocks.map((item) => block(item, brand)).join('\n')}
</article>
</body>
</html>`
}
