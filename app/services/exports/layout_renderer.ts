import { readFile } from 'node:fs/promises'
import type { BrandKit } from '../../../shared/layout/brand.ts'
import type { LayoutPlan, PlanBlock } from '../../../shared/layout/plan.ts'
import { STATUS_LABEL, type EntryFormat } from '../../../shared/layout/formats.ts'
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
export async function fontFaces(brand: BrandKit) {
  const faces = await Promise.all(
    brand.fonts.map(async (font) => {
      const truetype = font.format === 'truetype'
      let data = fontCache.get(font.file)
      if (!data) {
        // Repository fonts sit under the application root; packaged ones resolve like imports.
        const url = truetype
          ? new URL(`../../../${font.file}`, import.meta.url)
          : new URL(import.meta.resolve(font.file))
        data = (await readFile(url)).toString('base64')
        fontCache.set(font.file, data)
      }
      return truetype
        ? `@font-face{font-family:"${font.family}";font-style:normal;font-weight:${font.weight};font-display:block;src:url(data:font/ttf;base64,${data}) format("truetype");}`
        : `@font-face{font-family:"${font.family}";font-style:normal;font-weight:${font.weight};font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2");}`
    })
  )
  return faces.join('')
}

const M = PAGE_MARGIN_MM

const css = (plan: LayoutPlan, brand: BrandKit) => {
  const palette = brand.palette
  const brochure = plan.options.look === 'brochure'
  // Brochure type is larger in the two places that carry the page: title and figures.
  const heroScale = brochure ? 1.22 : 1
  const statScale = brochure ? 1.55 : 1
  const sizes = plan.blocks
    .map((item) => {
      switch (item.type) {
        case 'hero':
          return `#${item.id} h1{font-size:${+(item.fontPt * heroScale).toFixed(1)}pt}#${item.id} .summary{font-size:${(item.fontPt * 0.52).toFixed(1)}pt}`
        case 'results':
          return `#${item.id} .stat-value{font-size:${+(item.fontPt * statScale).toFixed(1)}pt}`
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
/* Bands run edge to edge; text blocks keep the 16mm side margin below. */
@page{size:A4;margin:${M}mm 0}
@page:first{margin-top:0}
*{box-sizing:border-box}
body{margin:0;font-family:${brand.fonts[0]?.family ?? 'Arial'},Arial,sans-serif;color:${palette.text};background:${palette.background};line-height:${compact ? 1.4 : 1.5};-webkit-print-color-adjust:exact;print-color-adjust:exact}
article{position:relative}
article>:not(.hero):not(.stat-band){margin-inline:${M}mm}
.draft-banner{position:absolute;top:4mm;right:4mm;margin:0!important;padding:3pt 8pt;background:#b42318;color:#fff;font-size:7pt;font-weight:800;letter-spacing:.06em;z-index:2}
.hero{display:grid;grid-template-columns:1fr;gap:0 8mm;margin:0 0 7mm;padding:${M - 6}mm ${M}mm ${M - 6}mm;background:${palette.primary};color:#fff;break-inside:avoid}
.hero.has-figure{grid-template-columns:1fr 60mm;align-items:start}
.hero-text{min-width:0}
.brandbar{display:flex;align-items:center;gap:6pt;margin-bottom:${gap}pt;font-weight:700;font-size:10pt;color:#fff}
.hex{display:inline-block;width:13pt;height:15pt;background:${palette.accent};clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.kicker{margin:0 0 5pt;font-size:7.5pt;font-weight:800;letter-spacing:.12em;color:${palette.accent}}
.hero h1{margin:0 0 7pt;line-height:1.12;color:#fff;font-weight:800;overflow-wrap:anywhere}
.hero .summary{color:#e2e0d8;font-weight:400}
.hero .summary p{margin:0}
.hero-figure{margin:0;padding:6pt;background:#fff;border-radius:6pt;break-inside:avoid}
.hero-figure img{display:block;width:100%;max-height:150pt;object-fit:contain}
.stat-band{display:flex;gap:${gap}pt;margin:0 0 10mm;padding:7mm ${M}mm;background:${palette.accent};color:${palette.primary};break-inside:avoid}
.stat{flex:1 1 0;min-width:0;break-inside:avoid}
.stat-value{display:block;font-weight:800;line-height:1.05;color:${palette.primary}}
.mark{font-size:.45em;font-weight:700;margin-left:1px;vertical-align:super;line-height:0}
.stat-units{display:block;margin-top:3pt;font-size:9.5pt;font-weight:500;line-height:1.3}
.tag{display:inline-block;margin-top:5pt;padding:1.5pt 7pt;border:1px solid ${palette.primary};border-radius:99pt;font-size:6.5pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.stat-context{display:block;margin-top:3pt;font-size:8pt;line-height:1.3}
h2,h3{break-after:avoid;color:${palette.primary};font-weight:700}
h2{font-size:1.2em;margin:${gap + 2}pt 0 4pt;padding-bottom:3pt;border-bottom:1px solid ${palette.surface}}
h3{font-size:1.1em;margin:${gap}pt 0 3pt}
.columns{display:grid;grid-template-columns:1fr 1fr;gap:0 16mm;margin:0 0 10mm;break-inside:avoid}
.columns h2{margin:0 0 4pt;padding:0;border:0;font-size:7.5pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${palette.accentText}}
.columns p{margin:0 0 6pt}
p{margin:0 0 ${gap - 2}pt}
ul,ol{margin:0 0 ${gap - 2}pt;padding-left:18pt}
li{break-inside:avoid}
blockquote{margin:0 0 ${gap - 2}pt;padding-left:10pt;border-left:3px solid ${palette.accent};color:${palette.muted}}
sup.ref{font-size:7pt;line-height:0;color:${palette.muted};margin-left:1px}
sup.ref + sup.ref::before{content:","}
.steps{display:grid;grid-template-columns:repeat(var(--n,4),1fr);gap:0 ${gap}pt;margin:0 0 8mm;padding-top:${gap - 4}pt;border-top:3px solid ${palette.primary};break-inside:avoid}
.step{min-width:0}
.step-n{display:block;font-size:1.5em;font-weight:800;color:${palette.accentText}}
.step-title{display:block;margin:2pt 0;font-weight:700;color:${palette.primary}}
.step-text{display:block;color:${palette.muted};font-size:.92em;line-height:1.35}
.cards{display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:${gap - 2}pt;margin:0 0 8mm;break-inside:avoid}
.card{padding:${gap - 2}pt ${gap}pt;background:${palette.surface};border-radius:5pt;break-inside:avoid}
.card-title{display:block;margin-bottom:3pt;font-weight:700;color:${palette.primary}}
.card-text{display:block;color:${palette.muted};font-size:.92em;line-height:1.35}
.roadmap{display:flex;gap:${gap}pt;margin:0 0 8mm;padding:${gap - 2}pt ${gap}pt;border:1px dashed ${palette.muted};border-radius:5pt;break-inside:avoid}
.roadmap-label{flex:none;font-size:7.5pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${palette.primary}}
figure{margin:${gap}pt 0;break-inside:avoid}
figure img{display:block;max-width:100%;max-height:230pt;object-fit:contain;margin:0 auto}
figcaption{margin-top:3pt;color:${palette.muted};text-align:center}
.cta{display:flex;align-items:center;justify-content:space-between;gap:${gap}pt;margin:0 0 8mm;padding:${gap}pt ${gap + 4}pt;background:${palette.primary};border-radius:6pt;break-inside:avoid}
.cta-headline{font-weight:700;color:#fff}
.cta a{flex:none;margin-left:auto;padding:5pt 13pt;background:${palette.accent};color:${palette.primary};font-weight:800;text-decoration:none;border-radius:99pt}
.sources{margin-top:${gap + 2}pt;padding-top:5pt;border-top:1px solid ${palette.surface};color:${palette.muted};line-height:1.35;break-inside:avoid}
.sources .note{display:block;margin-bottom:1pt}
.sources ol{display:flex;flex-wrap:wrap;gap:0 10pt;margin:2pt 0 0;padding:0;list-style:none}
.sources li{counter-increment:src}
.sources li::before{content:attr(value) ". "}
a{color:inherit}
${formatCss(plan, brand, gap)}${brochure ? `\n${brochureCss(brand, gap)}` : ''}
${sizes}`
}

/**
 * Per-format designs. They only restyle the shared blocks, so the same plan
 * renders in any of them, and every colour is a brand colour or a mix of two.
 */
function formatCss(plan: LayoutPlan, brand: BrandKit, gap: number) {
  const { primary: p, accent: a, accentText: at, surface: s, muted: m } = brand.palette
  const f = (rule: string) => `article[data-format="${plan.format}"] ${rule}`
  switch (plan.format) {
    case 'portfolio':
      return [
        '.hero{background:#fff;color:' + p + ';border-bottom:1px solid ' + s + '}',
        '.hero .brandbar{color:' + p + '}',
        '.hero .kicker{display:inline-block;padding:2pt 8pt;border-radius:99pt;background:' +
          a +
          ';color:' +
          p +
          '}',
        '.hero h1{color:' + p + '}',
        '.hero .summary{color:' + m + ';font-size:1.05em}',
        '.hero::after{content:"";grid-column:1/-1;width:34mm;height:4pt;margin-top:6mm;border-radius:2pt;background:' +
          a +
          '}',
        '.hero-figure{box-shadow:0 0 0 1px ' + s + ';border-radius:10pt}',
        '.stat-band{background:#fff;color:' + p + ';border-bottom:1px solid ' + s + '}',
        '.stat{padding-left:9pt;border-left:3pt solid ' + a + '}',
        '.tag{border-color:' + m + ';color:' + m + '}',
        '.columns>div{padding-left:10pt;border-left:3pt solid ' + a + '}',
        '.cards{grid-template-columns:repeat(2,1fr)}',
        '.card{background:#fff;border:1px solid ' +
          s +
          ';border-top:3pt solid ' +
          a +
          ';border-radius:6pt}',
        '.roadmap{border:0;border-left:3pt solid ' +
          a +
          ';border-radius:0 5pt 5pt 0;background:' +
          s +
          '}',
      ]
        .map(f)
        .join('')
    case 'technical':
      return [
        '.hero{background-image:linear-gradient(rgb(255 255 255/.06) 1px,transparent 1px),linear-gradient(90deg,rgb(255 255 255/.06) 1px,transparent 1px);background-size:6mm 6mm}',
        '.hero .kicker{letter-spacing:.22em}',
        '.hero .kicker::before{content:"// ";color:#fff;opacity:.6}',
        '.hero h1{letter-spacing:-.01em}',
        '.steps{display:flex;gap:0;border-top:0;padding-top:0}',
        '.step{position:relative;flex:1 1 0;margin-right:16pt;padding:8pt 9pt;background:' +
          s +
          ';border:1px solid ' +
          p +
          ';border-radius:4pt}',
        '.step:last-child{margin-right:0}',
        '.step:not(:last-child)::after{content:"";position:absolute;top:calc(50% - 1pt);right:-16pt;width:10pt;height:2pt;background:' +
          p +
          '}',
        '.step:not(:last-child)::before{content:"";position:absolute;top:calc(50% - 4pt);right:-8pt;border:4pt solid transparent;border-left:6pt solid ' +
          p +
          '}',
        '.step-n{font-size:.95em;letter-spacing:.1em;color:' + at + '}',
        '.metrics{width:calc(100% - 32mm);margin-block:0 8mm;border-collapse:collapse;break-inside:avoid}',
        '.metrics tr{border-top:1px solid ' + s + '}',
        '.metrics tr:nth-child(odd){background:' + s + '}',
        '.metrics td{padding:' + (gap - 5) + 'pt 9pt;vertical-align:top}',
        '.m-value{width:27%;white-space:nowrap;font-size:1.55em;font-weight:800;line-height:1.1;color:' +
          p +
          ';font-variant-numeric:tabular-nums}',
        '.m-label{line-height:1.35}',
        '.m-context{display:block;margin-top:2pt;font-size:.85em;color:' + m + '}',
        '.m-tag{width:1%;white-space:nowrap;text-align:right}',
        '.cards{grid-template-columns:repeat(2,1fr)}',
        '.card{border-left:3pt solid ' + p + ';border-radius:0 5pt 5pt 0}',
        '.roadmap{border:0;border-left:4pt solid ' +
          a +
          ';border-radius:0 5pt 5pt 0;background:' +
          s +
          '}',
        '.roadmap-label{color:' + p + '}',
      ]
        .map(f)
        .join('')
    case 'vision':
      return [
        '.hero{background:radial-gradient(circle at 96% 0%,color-mix(in srgb,' +
          a +
          ' 30%,transparent),transparent 34%),linear-gradient(135deg,' +
          p +
          ' 0%,color-mix(in srgb,' +
          p +
          ' 80%,#fff) 100%)}',
        '.hero h1{letter-spacing:-.02em}',
        '.columns>div:first-child{padding-left:10pt;border-left:4pt solid ' + a + '}',
        '.columns>div:first-child p{font-size:1.2em;font-weight:700;line-height:1.35;color:' +
          p +
          '}',
        '.cards{grid-template-columns:repeat(2,1fr)}',
        '.card{border-top:3pt solid ' + p + ';border-radius:6pt}',
        '.chip{display:inline-block;margin-bottom:4pt;padding:1pt 7pt;border-radius:99pt;font-size:6.5pt;font-weight:800;letter-spacing:.08em;text-transform:uppercase}',
        '.chip-delivered{background:' + p + ';color:#fff}',
        '.chip-pilot{background:' + a + ';color:' + p + '}',
        '.chip-planned{border:1px dashed ' + p + ';color:' + p + '}',
        '.timeline{display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:0 ' +
          gap +
          'pt;margin-block:0 8mm;padding-top:14pt;border-top:2pt solid ' +
          p +
          ';break-inside:avoid}',
        '.tl-item{position:relative;min-width:0}',
        '.tl-item::before{content:"";position:absolute;top:-21pt;left:0;width:9pt;height:9pt;border-radius:50%;background:' +
          a +
          ';box-shadow:0 0 0 2pt ' +
          p +
          '}',
        '.tl-when{display:block;margin-bottom:2pt;font-size:1.1em;font-weight:800;color:' + p + '}',
        '.tl-text{display:block;color:' + m + ';font-size:.92em;line-height:1.35}',
      ]
        .map(f)
        .join('')
    default:
      return ''
  }
}

/**
 * The brochure look: a dark hero with a generated glow and ring graphic, very
 * large figures on the accent band and heavier section headings. It restyles the
 * same blocks as every other look, so it works with any entry format, and it
 * uses only brand colours and mixes of them. It comes after the format rules so
 * the look wins where both style the same part.
 */
function brochureCss(brand: BrandKit, gap: number) {
  const { primary: p, accent: a, accentText: at, surface: s } = brand.palette
  const mix = (pct: number) => `color-mix(in srgb,${a} ${pct}%,transparent)`
  const f = (rule: string) => `article[data-look="brochure"] ${rule}`
  return [
    `.hero{position:relative;overflow:hidden;color:#fff;border-bottom:0;padding:${M + 2}mm ${M}mm ${M + 6}mm;background:radial-gradient(60% 90% at 100% 0%,${mix(36)},transparent 62%),radial-gradient(50% 70% at 0% 100%,${mix(12)},transparent 70%),${p}}`,
    `.hero::before{content:"";position:absolute;right:-34mm;top:-38mm;width:130mm;height:130mm;border-radius:50%;background:repeating-radial-gradient(circle at center,transparent 0 5mm,${mix(24)} 5mm 5.3mm);pointer-events:none}`,
    `.hero::after{display:none}`,
    `.hero-text{position:relative;z-index:1}`,
    `.hero .brandbar{color:#fff}`,
    `.hero .kicker{display:inline-block;margin-bottom:8pt;padding:0 0 2pt;border-radius:0;background:none;border-bottom:2pt solid ${a};color:${a};font-size:10pt;font-weight:700;letter-spacing:.01em;text-transform:lowercase}`,
    `.hero .kicker::first-letter{text-transform:uppercase}`,
    `.hero .kicker::before{content:none}`,
    `.hero h1{color:#fff;font-weight:800;letter-spacing:-.025em;line-height:1.04}`,
    `.hero .summary{color:#dfe6f2}`,
    `.hero-figure{position:relative;z-index:1;box-shadow:none;border-radius:4pt}`,
    `.stat-band{background:${a};color:${p};padding:9mm ${M}mm}`,
    `.stat{padding-left:0;border-left:0}`,
    `.stat-value{letter-spacing:-.035em;line-height:1}`,
    `.stat-units{font-size:10pt;font-weight:600}`,
    `.tag{border-color:${p};color:${p}}`,
    `h2{margin-top:${gap + 8}pt;padding-bottom:0;border-bottom:0;font-size:1.5em;letter-spacing:-.02em;font-weight:800}`,
    `h2::before{content:"";display:block;width:10mm;height:3pt;margin-bottom:6pt;background:${a}}`,
    `.columns h2{margin:0 0 5pt;font-size:1.3em;font-weight:800;letter-spacing:-.015em;text-transform:none;color:${p}}`,
    `.columns>div{padding-left:0;border-left:0}`,
    `.columns>div:first-child p{font-size:inherit;font-weight:inherit;color:inherit;line-height:inherit}`,
    `.step-n{font-size:2.3em;font-weight:800;letter-spacing:-.03em;line-height:1;color:${at}}`,
    `.steps{border-top:0;padding-top:0}`,
    `.card{background:${s};border:0;border-top:3pt solid ${a};border-radius:0}`,
    `.roadmap{border:0;border-radius:0;background:${s};border-left:4pt solid ${a}}`,
    `.cta{background:${p}}`,
    `.cta a{border-radius:99pt}`,
    `.sources{border-top:0}`,
  ]
    .map(f)
    .join('')
}

const stat = (item: Extract<PlanBlock, { type: 'results' }>['items'][number]) =>
  `<div class="stat"><span class="stat-value">${item.prefix ? `${esc(item.prefix)} ` : ''}${esc(item.value)}${item.marker ? `<sup class="mark">${esc(item.marker)}</sup>` : ''}</span>${item.units ? `<span class="stat-units">${esc(item.units)}</span>` : ''}<span class="tag">${esc(item.label)}</span>${item.context ? `<span class="stat-context">${esc(item.context)}</span>` : ''}</div>`

const metric = (item: Extract<PlanBlock, { type: 'results' }>['items'][number]) =>
  `<tr><td class="m-value">${item.prefix ? `${esc(item.prefix)} ` : ''}${esc(item.value)}${item.marker ? `<sup class="mark">${esc(item.marker)}</sup>` : ''}</td><td class="m-label">${item.units ? esc(item.units) : ''}${item.context ? `<span class="m-context">${esc(item.context)}</span>` : ''}</td><td class="m-tag"><span class="tag">${esc(item.label)}</span></td></tr>`

const section = (value: { heading?: string; blocks: Parameters<typeof renderBlocks>[0] }) =>
  `<div>${value.heading ? `<h2>${esc(value.heading)}</h2>` : ''}${renderBlocks(value.blocks)}</div>`

function block(item: PlanBlock, brand: BrandKit, format: EntryFormat): string {
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
      return format === 'technical'
        ? `<table class="metrics" id="${item.id}"><tbody>${item.items.map(metric).join('')}</tbody></table>`
        : `<section class="stat-band" id="${item.id}">${item.items.map(stat).join('')}</section>`
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
            `<div class="card">${card.status ? `<span class="chip chip-${card.status}">${STATUS_LABEL[card.status]}</span>` : ''}<span class="card-title">${esc(card.title)}</span>${card.text ? `<span class="card-text">${esc(card.text)}</span>` : ''}</div>`
        )
        .join('')}</section>`
    case 'roadmap':
      if (item.items?.length && format === 'vision')
        return `<section class="timeline" id="${item.id}" style="--n:${item.items.length}">${item.items
          .map(
            (entry) =>
              `<div class="tl-item"><span class="tl-when">${esc(entry.title)}</span>${entry.text ? `<span class="tl-text">${esc(entry.text)}</span>` : ''}</div>`
          )
          .join('')}</section>`
      return `<div class="roadmap" id="${item.id}"><span class="roadmap-label">${esc(item.heading ?? 'Roadmap')}</span><span>${esc(item.text)}</span></div>`
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
<article data-format="${plan.format}" data-template="${esc(plan.template.id)}" data-template-version="${plan.template.version}" data-brand="${esc(brand.id)}@${brand.version}" data-variant="${plan.variant}" data-density="${plan.density}"${plan.options.look === 'brochure' ? ' data-look="brochure"' : ''}>
${preview ? '<p class="draft-banner">PREVIEW · NOT APPROVED FOR FINAL EXPORT</p>' : ''}
${plan.blocks.map((item) => block(item, brand, plan.format)).join('\n')}
</article>
</body>
</html>`
}
