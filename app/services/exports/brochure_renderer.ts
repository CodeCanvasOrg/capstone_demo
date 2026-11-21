import type { BrandKit } from '../../../shared/layout/brand.ts'
import type { ClientBlock, ClientSource } from '../../../shared/publication/client.ts'
import {
  plainText,
  type ParagraphBlock,
  type ParsedGroup,
  type ParsedSection,
} from '../../../shared/brochure/content.ts'
import type { DesignId } from '../../../shared/brochure/designs.ts'
import { esc, renderBlocks } from '#services/exports/client_blocks'
import { ribbonsSvg } from '#services/exports/collection_html'
import { fontFaces } from '#services/exports/layout_renderer'

/**
 * The nine page designs, each its own composition on its own A4 sheet, drawn in
 * the brand's colours. A design reads sections, cards, figures and bullets from
 * the page content and ignores what it has no place for, so any page can take
 * any design. Nothing here writes content: every word is the entry's own.
 */
export const BROCHURE_RENDERER_VERSION = 'brochure-1'
const SHEET_H = 296

export type BrochurePage = { design: DesignId; sections: ParsedSection[] }

const none: ParsedSection = { paragraphs: [], lists: [], bullets: [], groups: [], extra: [] }

const css = (brand: BrandKit) => {
  const p = brand.palette
  const hl = `color-mix(in srgb,${p.accentText} 76%,#000)`
  const blue = `color-mix(in srgb,${p.primary} 58%,#3d3d3d)`
  const grad = `radial-gradient(70% 95% at 100% 100%,color-mix(in srgb,${p.accent} 70%,transparent),transparent 62%),linear-gradient(155deg,${p.primary} 0%,${blue} 100%)`
  return `
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"${brand.fonts[0]?.family ?? 'Arial'}",Arial,sans-serif;color:${p.text};font-size:9.5pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:210mm;height:${SHEET_H}mm;overflow:hidden;break-after:page;background:#fff}
.sheet:last-child{break-after:auto}
h1,h2,h3,h4,p,ul,ol{margin:0}
.rt p{margin:0 0 .65em}
.rt p:last-child{margin-bottom:0}
.rt ul,.rt ol{margin:.5em 0 0;padding-left:1.1em}
.rt li{margin:0 0 .35em}
.rt a{color:inherit}
.rt sup.ref{font-size:.65em;line-height:0;margin-left:1px}
.dark{background:${p.primary};color:#fff}
.grad{background:${grad};color:#fff}
.hl{color:${hl}}
.pn{position:absolute;right:14mm;bottom:9mm;font-size:7pt;color:${p.muted}}
.dark .pn,.grad .pn{color:#fff;opacity:.7}
.brandbar{display:flex;align-items:center;gap:7pt;font-weight:800;font-size:11pt}
.hex{display:inline-block;width:14pt;height:16pt;background:${p.accent};clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.art{position:absolute;inset:0;width:100%;height:100%}
.glow{position:absolute;inset:0;background:radial-gradient(55% 45% at 78% 30%,color-mix(in srgb,${p.accent} 28%,transparent),transparent 70%)}
.src{position:absolute;left:22mm;right:30mm;bottom:9mm;font-size:6.5pt;color:${p.muted}}

/* sources */
.sheet.refs{height:auto;min-height:${SHEET_H}mm;overflow:visible;padding:24mm 30mm 20mm 22mm}
.refs h2{font-size:17pt;font-weight:800;letter-spacing:-.02em;color:${p.primary};margin-bottom:6mm}
.refs ol{padding-left:1.4em;font-size:8.6pt;line-height:1.5;color:${p.text}}
.refs li{margin:0 0 1.5mm;break-inside:avoid;overflow-wrap:anywhere}

/* cover */
.cover .in{position:absolute;inset:0;padding:20mm 22mm 24mm;display:flex;flex-direction:column}
.cover h1{margin-top:auto;font-size:40pt;font-weight:800;line-height:1.02;letter-spacing:-.03em;max-width:150mm;overflow-wrap:anywhere}
.cover .sub{margin-top:8mm;font-size:19pt;font-weight:300;line-height:1.2;max-width:140mm;color:#f2f0e9}

/* proof */
.proof .col{position:absolute;left:0;top:0;bottom:0;width:68mm;padding:36mm 8mm 22mm 14mm;display:flex;flex-direction:column;gap:9mm;color:#fff;background:linear-gradient(180deg,${p.primary} 0%,${blue} 52%,${p.accent} 100%)}
.proof .col .st{font-size:12.5pt;font-weight:700;line-height:1.25}
.proof .col h2{margin-top:auto;font-size:24pt;font-weight:700;line-height:1.1;letter-spacing:-.02em}
.proof .pts{position:absolute;left:84mm;right:18mm;top:46mm;bottom:26mm;display:flex;flex-direction:column;justify-content:space-around}
.proof .pt{display:grid;grid-template-columns:34mm 1fr;gap:6mm;align-items:center}
.proof .badge{width:34mm;height:34mm;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 25%,${blue},${p.primary});color:#fff;font-size:25pt;font-weight:300;letter-spacing:-.05em;box-shadow:0 0 0 1.4pt ${p.accent}}
.proof .pt h3{font-size:15pt;font-weight:700;color:${hl};margin-bottom:2mm}
.proof .pt .rt{font-size:9pt;line-height:1.4}

/* article */
.article .in{position:absolute;inset:0;padding:24mm 22mm 22mm}
.article h1{font-size:23pt;font-weight:800;line-height:1.08;letter-spacing:-.03em;max-width:140mm;color:${p.primary};margin-bottom:7mm}
.article .body{max-width:128mm;font-size:9.4pt;line-height:1.5}
.article .rt ul{margin:.6em 0 .9em}
.article .lead{margin-top:9mm;font-size:15pt;font-weight:700;line-height:1.15;color:${hl};max-width:104mm}
.article .close{margin-top:7mm;font-size:23pt;font-weight:800;line-height:1.05;letter-spacing:-.03em;color:${hl};max-width:100mm}
.article .ring{position:absolute;right:20mm;bottom:22mm;width:44mm;height:44mm}

/* offer */
.offer .band{position:absolute;left:0;right:0;top:0;height:100mm;padding:26mm 22mm 0;display:grid;grid-template-columns:62mm 1fr;gap:12mm;color:#fff}
.offer .band h1{font-size:21pt;font-weight:800;line-height:1.06;letter-spacing:-.02em}
.offer .band .rt{font-size:8.6pt;line-height:1.5;opacity:.92}
.offer .big{position:absolute;right:20mm;top:58mm;text-align:right}
.offer .big b{display:block;font-size:80pt;font-weight:200;line-height:1.25;letter-spacing:-.05em;color:${p.accent}}
.offer .big span{display:block;margin-top:1mm;font-size:8.5pt;font-weight:600;color:#fff;max-width:60mm;margin-left:auto}
.offer h2{position:absolute;left:22mm;top:114mm;font-size:19pt;font-weight:800;letter-spacing:-.02em;color:${p.primary}}
.offer .cols{position:absolute;left:22mm;right:22mm;top:134mm;display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}
.offer .cols h3{font-size:11.5pt;font-weight:700;color:${p.primary};margin-bottom:2.5mm}
.offer .cols .rt{font-size:8.4pt;line-height:1.5}
.offer .foot{position:absolute;left:0;right:0;bottom:0;height:78mm;overflow:hidden;background:${p.primary}}

/* glance */
.glance .top{position:absolute;left:22mm;right:22mm;top:22mm;font-size:15pt;font-weight:700;line-height:1.15;letter-spacing:-.015em;color:${p.primary}}
.glance .band{position:absolute;left:0;right:0;top:50mm;height:104mm;background:${grad};padding:8mm 16mm 0;display:flex;flex-direction:column}
.glance .head{display:flex;flex:none;flex-wrap:wrap;align-items:baseline;gap:1mm 5mm;min-height:12mm}
.glance .band h2{font-size:26pt;font-weight:700;letter-spacing:-.025em;color:#fff}
.glance .band .cap{font-size:8pt;font-weight:600;color:#fff}
.glance .cards{flex:none;margin-top:3mm;display:grid;grid-template-columns:repeat(var(--n,4),1fr);gap:9mm}
.glance .card{background:#fff;color:${p.text};min-height:50mm;padding:3.5mm 3mm 9mm;position:relative}
.glance .card h3{text-align:center;font-size:11pt;font-weight:600;line-height:1.1;color:${hl};margin-bottom:2.2mm}
.glance .card ul{padding-left:3.2mm;font-size:6.4pt;line-height:1.35}
.glance .card li{margin-bottom:.9mm}
.glance .arrow{position:absolute;bottom:2mm;right:-8.2mm;width:7.4mm;font-size:13pt;line-height:1;color:${p.accent};font-weight:800;text-align:center}
.glance .plat{margin-top:auto;height:7mm;flex:none;background:${p.primary};color:#fff;font-size:6.6pt;font-weight:700;display:grid;place-items:center}
.glance .orch{height:7mm;flex:none;margin-bottom:6mm;background:color-mix(in srgb,${p.accent} 70%,#fff);color:${p.primary};font-size:6.6pt;font-weight:700;display:grid;place-items:center}
.glance .why{position:absolute;left:16mm;right:16mm;top:164mm;bottom:14mm;background:#fff}
.glance .why h2{font-size:13pt;font-weight:700;color:${p.primary};margin-bottom:3mm}
.glance .tbl{display:grid;grid-template-columns:1fr 54mm;gap:0;align-items:stretch}
.glance .rows{border-top:1px solid ${p.surface}}
.glance .row{display:grid;grid-template-columns:24mm repeat(var(--c,4),1fr);border-bottom:1px solid ${p.surface};min-height:11mm;align-items:center}
.glance .row b{font-size:7.4pt;color:${hl};font-weight:700}
.glance .row span{font-size:6.6pt;text-align:center;padding:0 1mm;border-left:1px dashed ${p.surface}}
.glance .side{background:${p.primary};color:#fff;padding:3.5mm}
.glance .side h4{font-size:7.6pt;font-weight:700;margin-bottom:2mm}
.glance .side li{font-size:6pt;line-height:1.3;margin-bottom:1.4mm}
.glance .side ul{padding-left:3mm}

/* columns */
.columns .band{position:absolute;left:0;right:0;top:0;height:82mm;padding:24mm 22mm 0;display:grid;grid-template-columns:58mm 1fr;gap:12mm;color:#fff}
.columns .band h1{font-size:21pt;font-weight:600;line-height:1.08;letter-spacing:-.02em}
.columns .band .rt{font-size:8.4pt;line-height:1.5}
.columns .bulb{position:absolute;right:22mm;top:48mm;width:30mm;height:30mm}
.columns h2{position:absolute;left:22mm;right:60mm;top:98mm;font-size:21pt;font-weight:700;letter-spacing:-.02em;color:${hl};line-height:1.05}
.columns .subt{position:absolute;left:22mm;top:118mm;font-size:7.6pt;font-weight:700;color:${p.primary}}
.columns .cols{position:absolute;left:22mm;right:22mm;top:138mm;bottom:20mm;display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:8mm}
.columns .cols h3{font-size:12.5pt;font-weight:700;line-height:1.1;color:${hl};margin-bottom:5mm;letter-spacing:-.01em}
.columns .cols .rt{font-size:8.2pt;line-height:1.45}

/* insight */
.insight .cols{position:absolute;left:22mm;right:22mm;top:24mm;bottom:20mm;display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:8mm}
.insight .cols h3{font-size:12.5pt;font-weight:700;line-height:1.1;color:${hl};margin-bottom:4mm;letter-spacing:-.01em}
.insight .cols .rt{font-size:8.2pt;line-height:1.45}
.insight .col{position:relative}
.insight .panel{position:absolute;left:0;right:0;bottom:0;height:46%;overflow:hidden;background:#0c0c0c}

/* recognition */
.recognition .l1{position:absolute;left:22mm;top:24mm;width:62mm;font-size:27pt;font-weight:800;line-height:.98;letter-spacing:-.035em;color:${hl}}
.recognition .r1{position:absolute;left:92mm;right:20mm;top:24mm;font-size:8.2pt;line-height:1.5}
.recognition .r1 h3{margin-top:6mm;font-size:10.5pt;font-weight:700;color:${hl};margin-bottom:2mm}
.recognition .l2{position:absolute;left:22mm;top:110mm;width:70mm;font-size:27pt;font-weight:800;line-height:.98;letter-spacing:-.035em;color:${hl}}
.recognition .grid{position:absolute;left:22mm;right:22mm;top:136mm;display:grid;grid-template-columns:repeat(3,1fr);gap:6mm}
.recognition .award{background:#fff;box-shadow:0 .5mm 2.4mm rgb(0 0 0/.18);padding:4mm;min-height:50mm;display:flex;flex-direction:column}
.recognition .award h3{font-size:10.5pt;font-weight:800;line-height:1.1;color:${p.primary};letter-spacing:-.01em}
.recognition .award ul{margin-top:2mm;padding-left:3.4mm;font-size:7.4pt;font-weight:700;line-height:1.3}
.recognition .award .note{margin-top:auto;padding-top:3mm;font-size:5.8pt;line-height:1.3;color:${p.muted}}

/* contact */
.contact .in{position:absolute;left:22mm;right:30mm;top:24mm;bottom:16mm;display:flex;flex-direction:column}
.contact h1,.contact h2{font-size:17pt;font-weight:800;letter-spacing:-.02em;color:${p.primary}}
.contact .who{margin-top:1.5mm;font-size:11pt;font-weight:700;color:${hl}}
.contact .lines{margin-top:1.5mm;font-size:8.6pt;line-height:1.45}
.contact .lines a{color:${blue}}
.contact .about{margin-top:12mm}
.contact .about h2{font-size:12pt;margin-bottom:3mm}
.contact .about .rt{font-size:7.8pt;line-height:1.5;max-width:140mm}
.contact .legal{margin-top:auto;font-size:6.2pt;line-height:1.4;color:${p.muted}}
`
}

const rich = (blocks: ParagraphBlock[]) =>
  blocks.length ? `<div class="rt">${renderBlocks(blocks)}</div>` : ''
const lists = (blocks: ClientBlock[]) =>
  blocks.length ? `<div class="rt">${renderBlocks(blocks)}</div>` : ''
const wordmark = (brand: BrandKit) =>
  `<div class="brandbar">${brand.logo?.kind === 'text' ? '<span class="hex"></span>' : ''}${esc(brand.name)}</div>`

/** Concentric rings of dots, the brochure's loading-ring motif, in the brand's accent text colour. */
const ring = (brand: BrandKit) => {
  const circles = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 - Math.PI / 2
    const r = 2.6 - i * 0.26
    return `<circle cx="${(22 + Math.cos(a) * 15).toFixed(2)}" cy="${(22 + Math.sin(a) * 15).toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="color-mix(in srgb,${brand.palette.accentText} 76%,#000)" stroke-width="${i < 6 ? 1.2 : 0.9}"/>`
  }).join('')
  return `<svg class="ring" viewBox="0 0 44 44" aria-hidden="true">${circles}</svg>`
}

const bulb = (brand: BrandKit) =>
  `<svg class="bulb" viewBox="0 0 60 60" fill="none" stroke="${brand.palette.accent}" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M30 6a15 15 0 0 0-8 27.7V40h16v-6.3A15 15 0 0 0 30 6z"/><path d="M23 46h14M25 51h10M27 55h6"/><path d="M30 17v10M25 22l5 5 5-5"/></svg>`

const panel = (brand: BrandKit, seed: string, cy?: number) =>
  `<div class="glow"></div>${ribbonsSvg(seed, brand.palette.accent, cy)}`

const cards = (groups: ParsedGroup[], body: (g: ParsedGroup) => string, tag = 'h3') =>
  groups.map((g) => `<div>${`<${tag}>${esc(g.heading)}</${tag}>`}${body(g)}</div>`).join('')

type Ctx = { brand: BrandKit; n: number; total: number; sources: ClientSource[] }

const pageNumber = (c: Ctx) => (c.n > 1 ? `<span class="pn">${c.n}</span>` : '')

const DESIGN: Record<DesignId, (s: ParsedSection[], c: Ctx) => string> = {
  cover: ([a = none], c) =>
    `<section class="sheet cover dark"><div class="glow"></div>${ribbonsSvg(a.title ?? 'cover', c.brand.palette.accent)}<div class="in">${wordmark(c.brand)}<h1>${esc(a.title ?? '')}</h1>${a.paragraphs[0] ? `<p class="sub">${esc(plainText(a.paragraphs[0].content))}</p>` : ''}</div></section>`,

  proof: ([a = none], c) =>
    `<section class="sheet proof"><div class="col">${a.paragraphs
      .slice(0, 2)
      .map((x) => `<p class="st">${esc(plainText(x.content))}</p>`)
      .join('')}<h2>${esc(a.title ?? '')}</h2></div><div class="pts">${a.groups
      .slice(0, 3)
      .map(
        (g) =>
          `<div class="pt"><div class="badge">${esc(g.stat ?? '')}</div><div><h3>${esc(g.heading)}</h3>${rich(g.paragraphs)}</div></div>`
      )
      .join(
        ''
      )}</div>${a.source ? `<p class="src">Source: ${esc(a.source)}</p>` : ''}${pageNumber(c)}</section>`,

  article: ([a = none], c) =>
    `<section class="sheet article"><div class="in"><h1>${esc(a.title ?? '')}</h1><div class="body">${rich(a.paragraphs)}${lists(a.lists)}</div>${a.groups[0] ? `<p class="lead">${esc(a.groups[0].heading)}</p>` : ''}${a.groups[1] ? `<p class="close">${esc(a.groups[1].heading)}</p>` : ''}</div>${ring(c.brand)}${pageNumber(c)}</section>`,

  offer: ([a = none, b = none], c) =>
    `<section class="sheet offer"><div class="band grad"><h1>${esc(a.title ?? '')}</h1>${rich(a.paragraphs.slice(0, 1))}</div>${
      a.stat
        ? `<div class="big"><b>${esc(a.stat.value)}</b><span>${esc(a.stat.label)}</span></div>`
        : ''
    }<h2>${esc(b.title ?? '')}</h2><div class="cols">${cards(b.groups.slice(0, 3), (g) => rich(g.paragraphs))}</div><div class="foot">${panel(c.brand, `${a.title}-offer`, 38)}</div>${pageNumber(c)}</section>`,

  glance: ([a = none, b = none, w = none], c) => {
    const cardsIn = b.groups.slice(0, 4)
    const rows = w.bullets.slice(0, 5).map((line) => {
      const at = line.indexOf(':')
      const label = at > 0 ? line.slice(0, at).trim() : ''
      const cells = (at > 0 ? line.slice(at + 1) : line).split('|').map((x) => x.trim())
      return { label, cells }
    })
    const cols = Math.max(2, ...rows.map((r) => r.cells.length))
    return `<section class="sheet glance"><p class="top">${esc(a.title ?? '')}</p><div class="band"><div class="head"><h2>${esc(b.title ?? '')}</h2>${b.paragraphs[0] ? `<span class="cap">${esc(plainText(b.paragraphs[0].content))}</span>` : ''}</div><div class="cards" style="--n:${cardsIn.length || 1}">${cardsIn
      .map(
        (g, i) =>
          `<div class="card"><h3>${esc(g.heading)}</h3>${lists(g.lists)}${i < cardsIn.length - 1 ? '<span class="arrow" aria-hidden="true">↔</span>' : ''}</div>`
      )
      .join(
        ''
      )}</div>${b.paragraphs[1] ? `<div class="plat">${esc(plainText(b.paragraphs[1].content))}</div>` : ''}${b.paragraphs[2] ? `<div class="orch">${esc(plainText(b.paragraphs[2].content))}</div>` : ''}</div><div class="why"><h2>${esc(w.title ?? '')}</h2><div class="tbl"><div class="rows">${rows
      .map(
        (r) =>
          `<div class="row" style="--c:${cols}"><b>${esc(r.label)}</b>${r.cells.map((x) => `<span>${esc(x)}</span>`).join('')}</div>`
      )
      .join(
        ''
      )}</div>${w.groups[0] ? `<div class="side"><h4>${esc(w.groups[0].heading)}</h4>${lists(w.groups[0].lists)}</div>` : '<div></div>'}</div></div>${pageNumber(c)}</section>`
  },

  columns: ([a = none, b = none, ..._rest], c) => {
    const groups = b.groups.slice(0, 3)
    return `<section class="sheet columns"><div class="band grad"><h1>${esc(a.title ?? '')}</h1>${rich(a.paragraphs.slice(0, 1))}</div>${bulb(c.brand)}<h2>${esc(b.title ?? '')}</h2>${b.paragraphs[0] ? `<p class="subt">${esc(plainText(b.paragraphs[0].content))}</p>` : ''}<div class="cols" style="--n:${groups.length || 1}">${cards(groups, (g) => `${rich(g.paragraphs)}${lists(g.lists)}`)}</div>${pageNumber(c)}</section>`
  },

  insight: ([a = none], c) => {
    const groups = a.groups.slice(0, 3)
    return `<section class="sheet insight"><div class="cols" style="--n:${groups.length || 1}">${groups
      .map(
        (g, i) =>
          `<div class="col"><h3>${esc(g.heading)}</h3>${rich(g.paragraphs)}${lists(g.lists)}${i === groups.length - 1 ? `<div class="panel">${panel(c.brand, `${g.heading}-insight`)}</div>` : ''}</div>`
      )
      .join('')}</div>${pageNumber(c)}</section>`
  },

  recognition: ([a = none, b = none], c) =>
    `<section class="sheet recognition"><h1 class="l1">${esc(a.title ?? '')}</h1><div class="r1">${rich(a.paragraphs)}${a.groups[0] ? `<h3>${esc(a.groups[0].heading)}</h3>${rich(a.groups[0].paragraphs)}` : ''}</div><h2 class="l2">${esc(b.title ?? '')}</h2><div class="grid">${b.groups
      .slice(0, 6)
      .map(
        (g) =>
          `<div class="award"><h3>${esc(g.heading)}</h3>${lists(g.lists)}${g.paragraphs[0] ? `<div class="note rt">${renderBlocks([g.paragraphs[0]])}</div>` : ''}</div>`
      )
      .join('')}</div>${pageNumber(c)}</section>`,

  contact: ([a = none, b = none], c) => {
    const person = a.groups[0]
    const legal = /^(copyright|©)/i
    const about = b.paragraphs.filter((x) => !legal.test(plainText(x.content)))
    const small = b.paragraphs.filter((x) => legal.test(plainText(x.content)))
    return `<section class="sheet contact"><div class="in"><h1>${esc(a.title ?? '')}</h1>${person ? `<p class="who">${esc(person.heading)}</p><div class="lines rt">${renderBlocks(person.paragraphs)}</div>` : ''}<div class="about"><h2>${esc(b.title ?? '')}</h2>${rich(about)}</div><div class="legal">${small.map((x) => `<p>${esc(plainText(x.content))}</p>`).join('')}</div></div>${pageNumber(c)}</section>`
  },
}

/**
 * Every entry ends with its sources on a sheet of their own, whatever the last design is.
 * The sheet grows past one page rather than clipping a long list.
 */
const sourcesSheet = (sources: ClientSource[]) =>
  sources.length
    ? `<section class="sheet refs"><h2>Sources</h2><ol>${sources
        .map((s) => `<li value="${s.number}">${esc(s.label)}${s.page ? `, p. ${s.page}` : ''}</li>`)
        .join('')}</ol></section>`
    : ''

/** The whole entry: one sheet per page, each in its own design. */
export async function renderBrochureHtml(
  pages: BrochurePage[],
  brand: BrandKit,
  { sources = [], preview = false }: { sources?: ClientSource[]; preview?: boolean } = {}
) {
  const body = pages
    .map((page, index) =>
      DESIGN[page.design](page.sections, { brand, n: index + 1, total: pages.length, sources })
    )
    .join('\n')
  const refs = sourcesSheet(sources)
  const banner = preview
    ? '<p style="position:fixed;top:4mm;right:4mm;margin:0;padding:3pt 8pt;background:#b42318;color:#fff;font-size:7pt;font-weight:800;z-index:9">PREVIEW · NOT APPROVED FOR FINAL EXPORT</p>'
    : ''
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><style>${await fontFaces(brand)}${css(brand)}</style></head><body>${banner}${body}${refs ? `\n${refs}` : ''}</body></html>`
}
