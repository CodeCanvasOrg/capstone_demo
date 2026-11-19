import { createHash } from 'node:crypto'
import type { BrandKit } from '../../../shared/layout/brand.ts'
import type { Manifest } from '../../../shared/layout/collection.ts'
import {
  CONTENTS_CARDS_PER_PAGE,
  STAT_QUALIFIER_LABEL,
  listSheets,
  type PlannedPage,
} from '../../../shared/layout/portfolio.ts'
import { esc } from '#services/exports/client_blocks'
import { fontFaces } from '#services/exports/layout_renderer'

/**
 * The portfolio's own pages in the brochure language: a generated ribbon cover,
 * a large statement, headline numbers, section openers, card contents and a
 * closing contact page. One sheet per page, edge to edge, in brand colours.
 *
 * Only copy the reviewer supplied is shown, and numbers come from the pinned
 * entries or the reviewer. Contact falls back to the brand kit, and a missing
 * contact leaves the closing page without one rather than inventing it. The
 * entry count is described as case studies, never as delivered projects.
 */
export type PageContext = {
  manifest: Manifest
  brand: BrandKit
  /** Contents rows with measured page numbers, in design order. */
  rows: { entryId: string; title: string; category: string; page: number }[]
}

const SHEET_H = 296

const css = (brand: BrandKit) => {
  const p = brand.palette
  const ink = (pct: number) => `color-mix(in srgb,${p.primary} ${pct}%,#fff)`
  return `
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"${brand.fonts[0]?.family ?? 'Arial'}",Arial,sans-serif;color:${p.text};font-size:10.5pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:210mm;height:${SHEET_H}mm;overflow:hidden;break-after:page;background:#fff}
.sheet:last-child{break-after:auto}
.dark{background:${p.primary};color:#fff}
.accent{background:${p.accent};color:${p.primary}}
.brandbar{display:flex;align-items:center;gap:7pt;font-weight:800;font-size:11pt;letter-spacing:.01em}
.hex{display:inline-block;width:14pt;height:16pt;background:${p.accent};clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.accent .hex{background:${p.primary}}
.rings{position:absolute;pointer-events:none;border-radius:50%}
.ribbons{position:absolute;inset:0;width:100%;height:100%}
.glow{position:absolute;inset:0;background:radial-gradient(55% 45% at 78% 34%,color-mix(in srgb,${p.accent} 30%,transparent),transparent 70%),radial-gradient(45% 40% at 8% 96%,color-mix(in srgb,${p.accent} 12%,transparent),transparent 70%)}
.pad{position:absolute;inset:0;padding:20mm 20mm 22mm 22mm;display:flex;flex-direction:column}
h1,h2,h3,p{margin:0}
.bar{display:block;width:14mm;height:4pt;background:${p.accent};margin-bottom:9mm}
.accent .bar{background:${p.primary}}

/* Cover */
.cover .title{margin-top:auto;font-weight:800;line-height:1.02;letter-spacing:-.03em;max-width:150mm;overflow-wrap:anywhere}
.cover .line{margin-top:7mm;font-size:13pt;font-weight:600;color:${p.accent}}
.cover.panel .line,.cover.plain .line{color:${p.muted}}
.cover.panel .band{position:absolute;left:0;right:0;bottom:0;height:62mm;background:${p.primary};color:#fff;padding:0 22mm;display:flex;align-items:center;justify-content:space-between}
.cover.panel .line{color:${p.accent};margin:0;font-size:12pt}
.cover.plain{border-top:8mm solid ${p.accent}}
.cover.plain .pad{padding-top:14mm}

/* Statement */
.statement .lede{font-weight:700;letter-spacing:-.015em;line-height:1.22}
.statement .more{margin-top:12mm;columns:2;column-gap:12mm;font-size:10.5pt;line-height:1.6}
.statement .more p{margin:0 0 4mm;break-inside:avoid}
.statement.panel .more{color:#d5dbe6}
.statement.plain .more{color:${p.muted}}
.statement .body{margin-top:auto;margin-bottom:auto}

/* Key numbers */
.highlights .pad{padding-top:24mm}
.highlights .stats{display:flex;flex-direction:column;flex:1;justify-content:center;gap:0}
.highlights .stat{display:grid;grid-template-columns:auto 1fr;gap:0 10mm;align-items:end;padding:8mm 0;border-top:1pt solid ${ink(14)}}
.highlights.band .stat{border-top-color:color-mix(in srgb,#fff 22%,transparent)}
.highlights .stat:first-child{border-top:0}
.highlights .value{font-weight:800;letter-spacing:-.045em;line-height:.9;color:${p.primary}}
.highlights.band .value{color:${p.accent}}
.highlights .what{padding-bottom:2mm;font-size:13pt;font-weight:600;line-height:1.3;max-width:70mm}
.highlights .how{display:block;margin-top:2mm;font-size:9pt;font-weight:600;color:${p.muted}}
.highlights.band .how{color:#c4cbd8}
.highlights .rule{display:block;width:14mm;height:4pt;background:${p.accent};margin-bottom:8mm}

/* Section opener */
.section .title{margin-top:auto;font-weight:800;line-height:1;letter-spacing:-.035em;max-width:160mm;overflow-wrap:anywhere}
.section .text{margin-top:8mm;max-width:120mm;font-size:13pt;line-height:1.45}
.section.bold .text{color:${p.primary}}
.section.plain .text{color:${p.muted}}

/* Contents */
.contents .pad{padding-top:22mm}
.contents h2{font-size:30pt;font-weight:800;letter-spacing:-.03em;line-height:1}
.contents .more{font-size:12pt;font-weight:700;color:${p.muted}}
.cards{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:54mm;gap:6mm;margin-top:12mm}
.card{position:relative;display:flex;flex-direction:column;padding:6mm 6mm 5mm;background:${p.surface};border-top:2.5pt solid ${p.primary};min-width:0}
.card .cat{font-size:8.5pt;font-weight:700;color:${p.accentText}}
.card .name{margin-top:2.5mm;font-size:13.5pt;font-weight:800;line-height:1.18;letter-spacing:-.015em;color:${p.primary};overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.card .pg{margin-top:auto;display:flex;align-items:baseline;gap:4pt;font-weight:800;color:${p.primary}}
.card .pg b{font-size:20pt;letter-spacing:-.03em;line-height:1}
.card .pg span{font-size:8.5pt;font-weight:600;color:${p.muted}}
.group{margin:7mm 0 2mm;font-size:9.5pt;font-weight:700;color:${p.accentText}}
.row{display:flex;gap:6mm;padding:2.2mm 0;border-bottom:1pt solid ${ink(10)}}
.row .t{flex:1;min-width:0;overflow-wrap:anywhere}
.row .n{font-weight:800;color:${p.primary}}
.list-head{margin-bottom:6mm}

/* Contact */
.contact .pad{justify-content:flex-end}
.contact .say{font-size:26pt;font-weight:800;line-height:1.1;letter-spacing:-.025em;max-width:140mm;margin-bottom:12mm}
.contact .name{font-size:30pt;font-weight:800;letter-spacing:-.03em;line-height:1;margin-bottom:8mm}
.contact .how p{margin:0 0 1.5mm;font-size:11.5pt;font-weight:600}
.contact.dark a,.contact.dark .how p{color:${p.accent}}
.contact.light .how p{color:${p.primary}}
.contact.light{border-bottom:8mm solid ${p.accent}}
`
}

/**
 * Flowing light ribbons, generated from the portfolio name so each portfolio
 * has its own cover and the same name always draws the same one. Stroke
 * colour is the brand accent; opacity and weight vary along the bundle.
 */
export function ribbonsSvg(seed: string, accent: string) {
  const bytes = createHash('sha256').update(seed).digest()
  const phase = (bytes[0] / 255) * Math.PI * 2
  const swing = 0.8 + (bytes[1] / 255) * 0.6
  const tilt = (bytes[2] / 255 - 0.5) * 0.5
  const lines = 46
  const paths: string[] = []
  for (let i = 0; i < lines; i++) {
    const t = i / (lines - 1)
    const pts: string[] = []
    for (let x = -10; x <= 220; x += 5) {
      const u = x / 210
      const envelope = Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.9 + 0.05)))
      const y =
        118 +
        tilt * (x - 105) +
        (t - 0.5) * 62 * (0.35 + envelope) +
        Math.sin(u * 6.2 + phase + t * 2.6) * 26 * swing * envelope +
        Math.sin(u * 11 + phase * 1.7 - t * 4) * 5 * envelope
      pts.push(`${x},${y.toFixed(1)}`)
    }
    const opacity = (0.22 + 0.7 * Math.sin(Math.PI * t) ** 1.6).toFixed(2)
    const width = (0.16 + 0.34 * Math.sin(Math.PI * t) ** 2).toFixed(2)
    paths.push(
      `<polyline points="${pts.join(' ')}" fill="none" stroke="${accent}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linejoin="round"/>`
    )
  }
  return `<svg class="ribbons" viewBox="0 0 210 ${SHEET_H}" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${paths.join('')}</svg>`
}

/** Concentric rings in the accent on dark pages, and in the primary on accent pages, so they always show. */
const rings = (brand: BrandKit, style: string, on: 'dark' | 'accent' = 'dark') => {
  const tone = on === 'dark' ? `${brand.palette.accent} 26%` : `${brand.palette.primary} 20%`
  return `<span class="rings" style="${style};background:repeating-radial-gradient(circle at center,transparent 0 6mm,color-mix(in srgb,${tone.split(' ')[0]} ${tone.split(' ')[1]},transparent) 6mm 6.3mm)"></span>`
}

const wordmark = (brand: BrandKit) =>
  `<div class="brandbar">${brand.logo?.kind === 'text' ? '<span class="hex"></span>' : ''}${esc(brand.name)}</div>`

/** Larger type for short statements, smaller for long ones, so a page is never empty or overfull. */
const statementSize = (length: number) =>
  length <= 240 ? 31 : length <= 520 ? 24 : length <= 900 ? 18 : 14

const paragraphs = (value: string) =>
  value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

const titleSize = (name: string, big: number, small: number) =>
  name.length <= 24 ? big : name.length <= 48 ? (big + small) / 2 : small

function cover(page: Extract<PlannedPage['spec'], { kind: 'cover' }>, ctx: PageContext) {
  const { manifest, brand } = ctx
  const name = manifest.name ?? 'Portfolio'
  const count = manifest.entries.length
  const line = page.subtitle ?? `${count} case ${count === 1 ? 'study' : 'studies'}`
  if (page.variant === 'ribbons')
    return `<section class="sheet cover ribbons-cover dark"><div class="glow"></div>${ribbonsSvg(name, brand.palette.accent)}<div class="pad">${wordmark(brand)}<h1 class="title" style="font-size:${titleSize(name, 44, 28)}pt">${esc(name)}</h1><p class="line">${esc(line)}</p></div></section>`
  if (page.variant === 'panel')
    return `<section class="sheet cover panel accent">${rings(brand, 'right:-50mm;top:-44mm;width:170mm;height:170mm', 'accent')}<div class="pad">${wordmark(brand)}<h1 class="title" style="font-size:${titleSize(name, 46, 29)}pt;margin-bottom:76mm">${esc(name)}</h1></div><div class="band">${wordmark(brand).replace('class="brandbar"', 'class="brandbar" style="color:#fff"')}<p class="line">${esc(line)}</p></div></section>`
  return `<section class="sheet cover plain"><div class="pad">${wordmark(brand)}<h1 class="title" style="font-size:${titleSize(name, 40, 26)}pt;color:${brand.palette.primary}"><span class="bar"></span>${esc(name)}</h1><p class="line">${esc(line)}</p></div></section>`
}

function statement(page: Extract<PlannedPage['spec'], { kind: 'statement' }>, ctx: PageContext) {
  const { manifest, brand } = ctx
  const parts = paragraphs(page.text ?? manifest.wrapper.about ?? '')
  const [lede = '', ...rest] = parts
  const size = statementSize(parts.join(' ').length)
  const more = rest.length
    ? `<div class="more">${rest.map((part) => `<p>${esc(part)}</p>`).join('')}</div>`
    : ''
  if (page.variant === 'panel')
    return `<section class="sheet statement panel dark"><div class="glow"></div>${rings(brand, 'right:-62mm;bottom:-62mm;width:190mm;height:190mm')}<div class="pad"><span class="bar"></span><div class="body"><p class="lede" style="font-size:${size}pt">${esc(lede)}</p>${more}</div></div></section>`
  return `<section class="sheet statement plain"><div class="pad"><span class="bar"></span><div class="body"><p class="lede" style="font-size:${size}pt;color:${brand.palette.primary}">${esc(lede)}</p>${more}</div></div></section>`
}

function highlights(page: Extract<PlannedPage['spec'], { kind: 'highlights' }>, ctx: PageContext) {
  const { brand } = ctx
  const n = page.items.length
  const size = n === 1 ? 120 : n === 2 ? 92 : n === 3 ? 74 : 60
  const items = page.items
    .map(
      (item) =>
        `<div class="stat"><span class="value" style="font-size:${size}pt">${esc(item.value)}</span><span class="what">${esc(item.label)}${item.qualifier ? `<span class="how">${STAT_QUALIFIER_LABEL[item.qualifier]}</span>` : ''}</span></div>`
    )
    .join('')
  const dark = page.variant === 'band'
  return `<section class="sheet highlights ${page.variant}${dark ? ' dark' : ''}">${dark ? `<div class="glow"></div>` : ''}<div class="pad"><span class="rule"></span><div class="stats">${items}</div><div class="brandbar" style="margin-top:8mm;${dark ? '' : `color:${brand.palette.primary}`}"><span class="hex"></span>${esc(brand.name)}</div></div></section>`
}

function section(page: Extract<PlannedPage['spec'], { kind: 'section' }>, ctx: PageContext) {
  const { brand } = ctx
  const size = titleSize(page.title, 52, 30)
  const text = page.text ? `<p class="text">${esc(page.text)}</p>` : ''
  if (page.variant === 'bold')
    return `<section class="sheet section bold accent">${rings(brand, 'right:-56mm;top:-50mm;width:180mm;height:180mm', 'accent')}<div class="pad">${wordmark(brand)}<h2 class="title" style="font-size:${size}pt">${esc(page.title)}</h2>${text}</div></section>`
  return `<section class="sheet section plain"><div class="pad">${wordmark(brand)}<h2 class="title" style="font-size:${size}pt;color:${brand.palette.primary}"><span class="bar"></span>${esc(page.title)}</h2>${text}</div></section>`
}

function contents(page: Extract<PlannedPage['spec'], { kind: 'contents' }>, ctx: PageContext) {
  const { rows } = ctx
  if (page.variant === 'cards') {
    const sheets: (typeof rows)[] = []
    for (let i = 0; i < rows.length; i += CONTENTS_CARDS_PER_PAGE)
      sheets.push(rows.slice(i, i + CONTENTS_CARDS_PER_PAGE))
    return (sheets.length ? sheets : [[]])
      .map(
        (chunk, index) =>
          `<section class="sheet contents"><div class="pad">${index === 0 ? '<h2>Contents</h2>' : '<p class="more">Contents, continued</p>'}<div class="cards">${chunk
            .map(
              (row) =>
                `<div class="card"><span class="cat">${esc(row.category)}</span><span class="name">${esc(row.title)}</span><span class="pg"><span>Page</span><b>${row.page}</b></span></div>`
            )
            .join('')}</div></div></section>`
      )
      .join('')
  }
  // List: the same packing the page count uses, so the sheets always match the plan.
  return listSheets(rows)
    .map((chunk, index) => {
      let last = ''
      const list = chunk
        .map((row) => {
          const head = row.category === last ? '' : `<div class="group">${esc(row.category)}</div>`
          last = row.category
          return `${head}<div class="row"><span class="t">${esc(row.title)}</span><span class="n">${row.page}</span></div>`
        })
        .join('')
      return `<section class="sheet contents"><div class="pad">${index === 0 ? '<h2 class="list-head">Contents</h2>' : '<p class="more list-head">Contents, continued</p>'}${list}</div></section>`
    })
    .join('')
}

function contact(page: Extract<PlannedPage['spec'], { kind: 'contact' }>, ctx: PageContext) {
  const { manifest, brand } = ctx
  const details = { ...brand.contact, ...manifest.wrapper.contact }
  const lines = [details.website, details.email, details.phone]
    .filter(Boolean)
    .map((line) => `<p>${esc(line!)}</p>`)
    .join('')
  const say = page.text ? `<p class="say">${esc(page.text)}</p>` : ''
  const dark = page.variant === 'dark'
  return `<section class="sheet contact ${page.variant}${dark ? ' dark' : ''}">${dark ? `<div class="glow"></div>${rings(brand, 'right:-60mm;top:-56mm;width:190mm;height:190mm')}` : ''}<div class="pad">${say}<div class="name">${esc(brand.name)}</div><div class="how">${lines}</div></div></section>`
}

/** The HTML for one planned page. Contents may be several sheets; every other page is one. */
export async function renderPageHtml(page: PlannedPage, ctx: PageContext) {
  const { spec } = page
  let body = ''
  switch (spec.kind) {
    case 'cover':
      body = cover(spec, ctx)
      break
    case 'statement':
      body = statement(spec, ctx)
      break
    case 'highlights':
      body = highlights(spec, ctx)
      break
    case 'section':
      body = section(spec, ctx)
      break
    case 'contents':
      body = contents(spec, ctx)
      break
    case 'contact':
      body = contact(spec, ctx)
      break
    case 'entry':
      throw new Error('Entries are rendered by the document exporter')
  }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><style>${await fontFaces(ctx.brand)}${css(ctx.brand)}</style></head><body>${body}</body></html>`
}
