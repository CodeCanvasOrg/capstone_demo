import type { BrandKit } from '../../../shared/layout/brand.ts'
import type { ClientBlock, ClientResult, ClientSource } from '../../../shared/publication/client.ts'
import {
  plainText,
  type ParsedGroup,
  type ParsedSection,
} from '../../../shared/brochure/content.ts'
import type { DesignId } from '../../../shared/brochure/designs.ts'
import { esc, renderBlocks } from '#services/exports/client_blocks'
import { ribbonsSvg } from '#services/exports/collection_html'
import { fontFaces } from '#services/exports/layout_renderer'
import type { BrochurePage } from '#services/exports/brochure_renderer'

/**
 * The web page export: the same pages the PDF draws, laid out as one responsive,
 * self-contained HTML file. Each print design maps to a web section with the same
 * intent (a cover becomes a hero, proof points become metric tiles, and so on).
 *
 * Unlike the A4 sheets, nothing is cut to fit: every heading, paragraph, list,
 * figure and source in the parsed page is shown. The file loads nothing: fonts and
 * images are inlined, there is no script, and its own CSP blocks remote requests.
 */
export const WEB_RENDERER_VERSION = 'web-1'

type Tone = 'light' | 'surface' | 'dark' | 'grad'
type GroupStyle = 'cards' | 'pillars' | 'metrics' | 'steps' | 'awards' | 'quotes'

type Ctx = {
  brand: BrandKit
  /** Next section id; titled sections are also listed in the top navigation. */
  id: (title?: string) => string
  /** Alternates light and tinted backgrounds for sections without a fixed tone. */
  tone: () => Tone
}

type Opts = {
  tone?: Tone
  cls?: string
  groups?: GroupStyle
  head?: 'split' | 'stack'
  /** Replaces the default intro (paragraphs and lists). */
  intro?: string
  /** Extra markup after the groups, inside the section. */
  after?: string
  /** Decorative ribbons behind the section. */
  art?: string
}

const QUALIFIER_LABELS: Record<ClientResult['qualifier'], string> = {
  measured: 'Measured',
  estimated: 'Estimated',
  client_reported: 'Client reported',
  design_target: 'Design target',
}

const none: ParsedSection = { paragraphs: [], lists: [], bullets: [], groups: [], extra: [] }

const rich = (blocks: ClientBlock[], cls = 'rt') =>
  blocks.length ? `<div class="${cls}">${renderBlocks(blocks)}</div>` : ''

const bigStat = (stat: ParsedSection['stat']) =>
  stat
    ? `<div class="big"><b>${esc(stat.value)}</b>${stat.label ? `<span>${esc(stat.label)}</span>` : ''}</div>`
    : ''

const source = (s: ParsedSection) => (s.source ? `<p class="src">Source: ${esc(s.source)}</p>` : '')

const groupCard = (g: ParsedGroup, cls = 'g') =>
  `<article class="${cls}">${g.stat ? `<p class="g-stat">${esc(g.stat)}</p>` : ''}<h3>${esc(g.heading)}</h3>${rich(g.paragraphs)}${rich(g.lists)}</article>`

function groupsHtml(groups: ParsedGroup[], style: GroupStyle): string {
  if (!groups.length) return ''
  if (style === 'quotes') {
    // The article's accent lead-in and large closing line, each followed by its own text.
    const [lead, close, ...rest] = groups
    return `${lead ? `<div class="quote lead"><p>${esc(lead.heading)}</p>${rich(lead.paragraphs)}${rich(lead.lists)}</div>` : ''}${
      close
        ? `<div class="quote close"><p>${esc(close.heading)}</p>${rich(close.paragraphs)}${rich(close.lists)}</div>`
        : ''
    }${groupsHtml(rest, 'cards')}`
  }
  const cap = style === 'awards' ? 3 : 4
  return `<div class="groups ${style}" style="--n:${Math.min(groups.length, cap)}">${groups
    .map((g) => groupCard(g))
    .join('')}</div>`
}

function section(s: ParsedSection, c: Ctx, o: Opts = {}) {
  const tone = o.tone ?? c.tone()
  const id = c.id(s.title)
  const intro = o.intro ?? `${rich(s.paragraphs)}${rich(s.lists)}`
  const head = o.head ?? 'split'
  const title = s.title ? `<h2>${esc(s.title)}</h2>` : ''
  return `<section id="${id}" class="sec tone-${tone}${o.cls ? ` ${o.cls}` : ''}">${o.art ?? ''}<div class="wrap"><div class="head ${head}">${title}${
    intro || s.stat ? `<div class="intro">${intro}${bigStat(s.stat)}</div>` : ''
  }</div>${groupsHtml(s.groups, o.groups ?? 'pillars')}${o.after ?? ''}${rich(s.extra)}${source(s)}</div></section>`
}

const art = (c: Ctx, seed: string, cy = 80) =>
  `<div class="art" aria-hidden="true"><div class="glow"></div>${ribbonsSvg(seed, c.brand.palette.accent, cy)}</div>`

/** Sections a design has no fixed place for, in the default style. */
const rest = (sections: ParsedSection[], c: Ctx) => sections.map((s) => section(s, c)).join('')

const DESIGN: Record<DesignId, (s: ParsedSection[], c: Ctx) => string> = {
  cover: ([a = none, ...more], c) => {
    const [first, ...paragraphs] = a.paragraphs
    const id = c.id()
    return `<header id="${id}" class="hero tone-dark">${art(c, a.title ?? 'cover')}<div class="wrap"><p class="eyebrow">${esc(c.brand.name)}</p>${
      a.title ? `<h1>${esc(a.title)}</h1>` : ''
    }${first ? rich([first], 'lead rt') : ''}${rich(paragraphs)}${rich(a.lists)}${bigStat(a.stat)}${groupsHtml(a.groups, 'metrics')}${rich(a.extra)}${source(a)}<a class="cta" href="#after-${id}">Explore <span aria-hidden="true">↓</span></a></div></header><div id="after-${id}"></div>${rest(more, c)}`
  },

  proof: ([a = none, ...more], c) =>
    section(a, c, { tone: 'light', cls: 'proof', groups: 'metrics' }) + rest(more, c),

  article: ([a = none, ...more], c) =>
    section(a, c, { tone: 'light', cls: 'article', head: 'stack', groups: 'quotes' }) +
    rest(more, c),

  offer: ([a = none, b = none, ...more], c) =>
    section(a, c, { tone: 'grad', cls: 'offer', art: art(c, `${a.title}-offer`, 140) }) +
    section(b, c, { tone: 'light', groups: 'pillars' }) +
    rest(more, c),

  glance: ([a = none, b = none, w = none, ...more], c) => {
    const [caption, platform, orchestration, ...paragraphs] = b.paragraphs
    const bands = [platform, orchestration]
      .map((p, i) =>
        p ? `<p class="band ${i ? 'orch' : 'plat'}">${esc(plainText(p.content))}</p>` : ''
      )
      .join('')
    const rows = w.bullets.map((line) => {
      const at = line.indexOf(':')
      const label = at > 0 ? line.slice(0, at).trim() : ''
      const cells = (at > 0 ? line.slice(at + 1) : line).split('|').map((x) => x.trim())
      return { label, cells }
    })
    const cols = Math.max(1, ...rows.map((r) => r.cells.length))
    const table = rows.length
      ? `<div class="tbl" role="region" aria-label="${esc(w.title ?? 'Comparison')}" tabindex="0"><table><tbody>${rows
          .map(
            (r) =>
              `<tr><th scope="row">${esc(r.label)}</th>${Array.from({ length: cols }, (_, i) => `<td>${esc(r.cells[i] ?? '')}</td>`).join('')}</tr>`
          )
          .join('')}</tbody></table></div>`
      : ''
    const [side, ...cards] = w.groups
    return `${section(a, c, { tone: 'light', cls: 'glance-top', head: 'stack' })}${section(b, c, {
      tone: 'grad',
      groups: 'steps',
      intro: `${caption ? `<p class="cap">${esc(plainText(caption.content))}</p>` : ''}${rich(paragraphs)}${rich(b.lists)}`,
      after: bands,
    })}${section({ ...w, groups: cards }, c, {
      tone: 'light',
      cls: 'glance-why',
      head: 'stack',
      groups: 'cards',
      intro: rich(w.paragraphs),
      after:
        table || side
          ? `<div class="why">${table}${side ? `<aside class="side"><h3>${esc(side.heading)}</h3>${rich(side.paragraphs)}${rich(side.lists)}</aside>` : ''}</div>`
          : '',
    })}${rest(more, c)}`
  },

  columns: ([a = none, b = none, ...more], c) =>
    section(a, c, { tone: 'grad', cls: 'banner', art: art(c, `${a.title}-columns`, 150) }) +
    section(b, c, { tone: 'light', groups: 'pillars' }) +
    rest(more, c),

  insight: ([a = none, ...more], c) =>
    section(a, c, {
      tone: 'light',
      cls: 'insight',
      groups: 'pillars',
      after: `<div class="panel">${art(c, `${a.groups.at(-1)?.heading ?? a.title}-insight`, 60)}</div>`,
    }) + rest(more, c),

  recognition: ([a = none, b = none, ...more], c) =>
    section(a, c, { tone: 'light', cls: 'display', groups: 'cards' }) +
    section(b, c, { tone: 'surface', cls: 'display', groups: 'awards' }) +
    rest(more, c),

  contact: ([a = none, b = none, ...more], c) => {
    const [person, ...groups] = a.groups
    const legal = /^(copyright|©)/i
    const about = b.paragraphs.filter((x) => !legal.test(plainText(x.content)))
    const small = b.paragraphs.filter((x) => legal.test(plainText(x.content)))
    const id = c.id(a.title)
    return `<section id="${id}" class="sec tone-dark contact"><div class="wrap"><div class="cols"><div>${a.title ? `<h2>${esc(a.title)}</h2>` : ''}${rich(a.paragraphs)}${
      person
        ? `<p class="who">${esc(person.heading)}</p>${rich(person.paragraphs, 'lines rt')}${rich(person.lists)}`
        : ''
    }${rich(a.lists)}${bigStat(a.stat)}</div><div>${b.title ? `<h3>${esc(b.title)}</h3>` : ''}${rich(about)}${rich(b.lists)}${bigStat(b.stat)}</div></div>${groupsHtml(
      [...groups, ...b.groups],
      'cards'
    )}${rich([...a.extra, ...b.extra])}${source(a)}${source(b)}${
      small.length
        ? `<div class="legal">${small.map((x) => `<p>${esc(plainText(x.content))}</p>`).join('')}</div>`
        : ''
    }</div></section>${rest(more, c)}`
  },
}

const resultsSection = (results: ClientResult[]) => {
  const context = (r: ClientResult) =>
    [r.units, r.scope, r.baseline && `baseline: ${r.baseline}`, r.period, r.methodology]
      .filter((part): part is string => Boolean(part))
      .map(esc)
      .join('; ')
  // The qualifier is visible text beside its value, as in the PDF, never only a colour.
  return `<section id="results" class="sec tone-dark results"><div class="wrap"><p class="eyebrow">Key results</p><div class="groups metrics" style="--n:${Math.min(results.length, 4)}">${results
    .map(
      (r) =>
        `<article class="g"><p class="g-stat">${esc(r.value)}</p><p class="q">${QUALIFIER_LABELS[r.qualifier]}</p>${context(r) ? `<p class="ctx">${context(r)}</p>` : ''}</article>`
    )
    .join('')}</div></div></section>`
}

const sourcesSection = (sources: ClientSource[]) =>
  sources.length
    ? `<section id="sources" class="sec tone-surface sources"><div class="wrap"><h2>Sources</h2><ol>${sources
        .map(
          (s) =>
            `<li id="src-${s.number}" value="${s.number}">${esc(s.label)}${s.page ? `, p. ${s.page}` : ''}</li>`
        )
        .join('')}</ol></div></section>`
    : ''

/** Reference markers become links to their source, where that source is listed. */
const linkReferences = (html: string, sources: ClientSource[]) => {
  const known = new Set(sources.map((s) => String(s.number)))
  return html.replace(/<sup class="ref">(\d+)<\/sup>/g, (match, n: string) =>
    known.has(n)
      ? `<sup class="ref"><a href="#src-${n}" aria-label="Source ${n}">${n}</a></sup>`
      : match
  )
}

const css = (brand: BrandKit) => {
  const p = brand.palette
  const hl = `color-mix(in srgb,${p.accentText} 76%,#000)`
  const deep = `color-mix(in srgb,${p.primary} 82%,#000)`
  const blue = `color-mix(in srgb,${p.primary} 58%,#2f5fb0)`
  return `
:root{--primary:${p.primary};--accent:${p.accent};--hl:${hl};--text:${p.text};--muted:${p.muted};--bg:${p.background};--surface:${p.surface};--deep:${deep};--pad:clamp(1.25rem,5vw,4rem);--ease:cubic-bezier(.2,.7,.2,1)}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;font-family:"${brand.fonts[0]?.family ?? 'Arial'}",system-ui,Arial,sans-serif;font-size:1.0625rem;line-height:1.6;color:var(--text);background:var(--bg);-webkit-font-smoothing:antialiased}
h1,h2,h3,p,ol,ul{margin:0}
img{max-width:100%;height:auto;display:block}
a{color:inherit;text-underline-offset:.2em;text-decoration-thickness:1px}
a:hover{text-decoration-thickness:2px}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.wrap{max-width:80rem;margin:0 auto;padding-inline:var(--pad);position:relative}
.preview{position:sticky;top:0;z-index:20;margin:0;padding:.4rem var(--pad);background:#b42318;color:#fff;font-size:.75rem;font-weight:800;letter-spacing:.06em;text-align:center}

/* top bar */
.top{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--deep) 92%,transparent);backdrop-filter:blur(8px);color:#fff;border-bottom:1px solid rgb(255 255 255/.08)}
.preview+.top{top:1.9rem}
.top .wrap{display:flex;align-items:center;gap:2rem;min-height:3.75rem}
.brand{display:flex;align-items:center;gap:.55rem;font-weight:800;text-decoration:none;white-space:nowrap}
.hex{display:inline-block;width:.95rem;height:1.1rem;background:var(--accent);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.top ul{display:flex;gap:1.5rem;list-style:none;padding:0;margin-left:auto;overflow-x:auto;scrollbar-width:none;font-size:.875rem;font-weight:600}
.top li a{display:block;padding:.4rem 0;text-decoration:none;white-space:nowrap;opacity:.8;border-bottom:2px solid transparent;transition:opacity .2s,border-color .2s}
.top li a:hover{opacity:1;border-color:var(--accent)}

/* tones */
.tone-light{background:var(--bg)}
.tone-surface{background:var(--surface)}
.tone-dark{background:var(--deep);color:#fff}
.tone-grad{background:radial-gradient(70% 95% at 100% 100%,color-mix(in srgb,var(--accent) 55%,transparent),transparent 62%),linear-gradient(155deg,var(--primary) 0%,${blue} 100%);color:#fff}
.tone-dark .rt a,.tone-grad .rt a{color:#fff}

/* type */
.eyebrow{display:flex;align-items:center;gap:.6rem;font-size:.8125rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--hl);margin-bottom:1.5rem}
.eyebrow::before{content:"";width:1.75rem;height:3px;background:var(--accent)}
.tone-dark .eyebrow,.tone-grad .eyebrow{color:var(--accent)}
h1{font-size:clamp(2.75rem,5.5vw + 1rem,5.75rem);font-weight:800;line-height:1;letter-spacing:-.04em;max-width:16ch;overflow-wrap:anywhere}
h2{font-size:clamp(2rem,3.2vw + 1rem,3.5rem);font-weight:800;line-height:1.05;letter-spacing:-.035em;overflow-wrap:anywhere}
h3{font-size:1.25rem;font-weight:700;line-height:1.2;letter-spacing:-.01em}
.rt p{margin:0 0 .9em}
.rt p:last-child{margin-bottom:0}
.rt ul,.rt ol{margin:.6em 0 0;padding-left:1.2em}
.rt li{margin:0 0 .4em}
.rt li::marker{color:var(--hl)}
.tone-dark .rt li::marker,.tone-grad .rt li::marker{color:var(--accent)}
.rt blockquote{margin:1em 0;padding-left:1em;border-left:3px solid var(--accent)}
.rt pre{overflow-x:auto;padding:1em;background:rgb(0 0 0/.06)}
.rt img{margin:1.5em 0}
sup.ref{font-size:.65em;line-height:0;margin-left:1px}
sup.ref a{text-decoration:none;color:var(--hl);font-weight:700}
.tone-dark sup.ref a,.tone-grad sup.ref a{color:var(--accent)}
.src{margin-top:2.5rem;font-size:.8125rem;color:var(--muted)}
.tone-dark .src,.tone-grad .src{color:rgb(255 255 255/.7)}

/* hero */
.hero{position:relative;overflow:hidden;min-height:min(88vh,56rem);display:flex;align-items:flex-end;padding-block:clamp(6rem,14vw,10rem) clamp(4rem,8vw,6rem)}
.hero .wrap{width:100%}
.hero .lead{margin-top:2rem;max-width:38ch;font-size:clamp(1.25rem,1.2vw + 1rem,1.75rem);font-weight:400;line-height:1.35;color:rgb(255 255 255/.86)}
.hero .lead p{margin:0}
.hero .rt:not(.lead){margin-top:1.25rem;max-width:62ch;color:rgb(255 255 255/.8)}
.hero .groups{margin-top:3rem}
.cta{display:inline-flex;align-items:center;gap:.6rem;margin-top:3rem;padding:.9rem 1.6rem;background:var(--accent);color:var(--primary);font-weight:700;text-decoration:none;transition:gap .25s var(--ease),filter .2s}
.cta:hover{gap:1rem;filter:brightness(1.05)}
.art{position:absolute;inset:0;pointer-events:none}
.art .glow{position:absolute;inset:0;background:radial-gradient(55% 45% at 78% 30%,color-mix(in srgb,var(--accent) 24%,transparent),transparent 70%)}
.art .ribbons{position:absolute;inset:0;width:100%;height:100%;opacity:.85}

/* sections */
.sec{position:relative;overflow:hidden;padding-block:clamp(4rem,9vw,8rem)}
.head{display:grid;gap:1.5rem 4rem;margin-bottom:clamp(2.5rem,5vw,4rem)}
.head:empty{display:none}
.head.split{grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:start}
.head.split:not(:has(h2)){grid-template-columns:minmax(0,1fr)}
.head.stack .intro{max-width:68ch}
.intro{font-size:1.125rem;color:inherit}
.tone-light .intro,.tone-surface .intro{color:color-mix(in srgb,var(--text) 88%,var(--bg))}
.tone-light h2,.tone-surface h2{color:var(--primary)}
.big{margin-top:2rem;display:flex;flex-direction:column;gap:.5rem}
.big b{font-size:clamp(4rem,9vw,8rem);font-weight:200;line-height:.95;letter-spacing:-.05em;color:var(--hl)}
.tone-dark .big b,.tone-grad .big b{color:var(--accent)}
.big span{max-width:30ch;font-weight:600}

/* groups */
.groups{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:clamp(1rem,2.5vw,2rem)}
.g h3{margin-bottom:.75rem}
.g .rt{font-size:1rem}
.g-stat{font-size:clamp(2.75rem,5vw,4.25rem);font-weight:200;line-height:1;letter-spacing:-.05em;color:var(--hl);margin-bottom:1rem}
.tone-dark .g-stat,.tone-grad .g-stat{color:var(--accent)}
.pillars .g{padding-top:1.5rem;border-top:3px solid var(--accent)}
.tone-light .pillars h3,.tone-surface .pillars h3{color:var(--hl)}
.cards .g,.awards .g,.steps .g{position:relative;padding:clamp(1.5rem,2.5vw,2rem);background:var(--surface);border-top:4px solid transparent;transition:transform .3s var(--ease),border-color .3s,box-shadow .3s}
.tone-surface .cards .g,.tone-surface .awards .g{background:var(--bg)}
.cards .g:hover,.awards .g:hover{transform:translateY(-4px);border-color:var(--accent);box-shadow:0 18px 40px -24px rgb(0 0 0/.35)}
.cards h3,.awards h3{color:var(--primary)}
.awards .g{display:flex;flex-direction:column}
.awards .g .rt:last-child:not(:only-of-type){margin-top:auto;padding-top:1rem;font-size:.8125rem;color:var(--muted)}
.metrics .g{padding-top:1.5rem;border-top:1px solid color-mix(in srgb,currentColor 22%,transparent)}
.metrics .q{display:inline-block;margin-bottom:.6rem;padding:.2rem .55rem;font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:color-mix(in srgb,var(--accent) 22%,transparent)}
.metrics .ctx{font-size:.9375rem;opacity:.85}
.steps .g{background:#fff;color:var(--text)}
.steps h3{color:var(--hl);text-align:center}
.steps .g:not(:last-child)::after{content:"→";position:absolute;top:50%;right:calc(-1 * clamp(1rem,2.5vw,2rem));width:clamp(1rem,2.5vw,2rem);transform:translateY(-50%);text-align:center;font-size:1.5rem;font-weight:800;color:var(--accent)}
.band{margin-top:1rem;padding:.8rem 1rem;text-align:center;font-size:.875rem;font-weight:700}
.band.plat{margin-top:2rem;background:var(--primary);color:#fff}
.band.orch{background:color-mix(in srgb,var(--accent) 70%,#fff);color:var(--primary)}
.cap{font-weight:600}
.quote{margin-top:3rem;max-width:40ch}
.quote>p{font-weight:800;letter-spacing:-.03em;line-height:1.1;color:var(--hl)}
.quote.lead>p{font-size:clamp(1.5rem,1.6vw + 1rem,2.25rem);font-weight:700}
.quote.close>p{font-size:clamp(2rem,3vw + 1rem,3.5rem)}
.quote .rt{margin-top:1rem;max-width:68ch}
.quote+.groups{margin-top:3rem}

/* designs */
.proof .intro p{font-size:clamp(1.25rem,1vw + 1rem,1.6rem);font-weight:700;line-height:1.3;color:var(--primary)}
.proof .intro p+p{margin-top:1rem}
.article h2{max-width:20ch}
.glance-top{padding-bottom:0}
.glance-top h2{font-size:clamp(1.5rem,1.6vw + 1rem,2.25rem);max-width:30ch}
.glance-top .head{margin-bottom:clamp(2rem,4vw,3rem)}
.why{display:grid;grid-template-columns:minmax(0,1fr) minmax(16rem,22rem);gap:2rem;margin-top:2rem}
.why:not(:has(.side)){grid-template-columns:minmax(0,1fr)}
.tbl{overflow-x:auto}
.tbl table{width:100%;border-collapse:collapse;font-size:.9375rem}
.tbl th,.tbl td{padding:.9rem 1rem;border-bottom:1px solid var(--surface);text-align:left;vertical-align:top}
.tbl tr:first-child>*{border-top:1px solid var(--surface)}
.tbl th{color:var(--hl);font-weight:700;white-space:nowrap}
.tbl td{border-left:1px dashed var(--surface)}
.side{padding:1.5rem;background:var(--primary);color:#fff}
.side h3{font-size:1rem;margin-bottom:.75rem}
.side .rt{font-size:.9375rem}
.side .rt a{color:#fff}
.glance-why .groups{margin-top:2rem}
.insight .panel{position:relative;height:clamp(12rem,24vw,18rem);margin-top:clamp(2.5rem,5vw,4rem);background:#07101f;overflow:hidden}
.display h2{font-size:clamp(2.5rem,4.5vw + 1rem,4.75rem);line-height:.98;color:var(--hl)!important}
.contact .cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3rem 4rem}
.contact h3{font-size:1.25rem;margin-bottom:1rem}
.contact .who{margin-top:1.5rem;font-size:1.25rem;font-weight:700;color:var(--accent)}
.contact .lines{margin-top:.5rem}
.contact .groups{margin-top:3rem}
.contact .cards .g{background:rgb(255 255 255/.06)}
.contact .cards h3{color:#fff}
.contact .legal{margin-top:4rem;padding-top:1.5rem;border-top:1px solid rgb(255 255 255/.15);font-size:.8125rem;color:rgb(255 255 255/.6)}
.results .eyebrow{margin-bottom:2.5rem}
.sources h2{font-size:clamp(1.5rem,1.4vw + 1rem,2rem);margin-bottom:2rem}
.sources ol{padding-left:1.5em;columns:2 28rem;column-gap:4rem;font-size:.9375rem;color:var(--muted)}
.sources li{margin-bottom:.75rem;break-inside:avoid;overflow-wrap:anywhere;scroll-margin-top:6rem}
.sources li:target{color:var(--text);background:color-mix(in srgb,var(--accent) 22%,transparent)}
.sec,.hero,#results{scroll-margin-top:3.75rem}

/* footer */
.foot{padding-block:2.5rem;background:#000;color:rgb(255 255 255/.7);font-size:.875rem}
.foot .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem}
.foot .brand{color:#fff}

@media (max-width:60rem){
.head.split,.why,.contact .cols{grid-template-columns:minmax(0,1fr)}
.groups{grid-template-columns:repeat(min(var(--n,3),2),minmax(0,1fr))}
.steps .g:not(:last-child)::after{display:none}
}
@media (max-width:40rem){
.groups{grid-template-columns:minmax(0,1fr)}
.top ul{display:none}
}
@media (prefers-reduced-motion:reduce){
html{scroll-behavior:auto}
*,*::before,*::after{transition:none!important}
.cards .g:hover,.awards .g:hover{transform:none}
}
@media print{
.top,.cta,.preview{display:none}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hero{min-height:auto}
.sec,.hero{break-inside:avoid-page}
.g{break-inside:avoid}
}
`
}

export type WebRenderOptions = {
  title?: string
  sources?: ClientSource[]
  /** Key results, shown when the PDF for the same document shows them. */
  results?: ClientResult[]
  preview?: boolean
}

/** The whole entry as one web page: a section for each part of each page, then results and sources. */
export async function renderWebHtml(
  pages: BrochurePage[],
  brand: BrandKit,
  { title, sources = [], results = [], preview = false }: WebRenderOptions = {}
) {
  const nav: { id: string; title: string }[] = []
  let n = 0
  let alternate = false
  const ctx: Ctx = {
    brand,
    id: (heading) => {
      const id = `s-${++n}`
      if (heading && n > 1) nav.push({ id, title: heading })
      return id
    },
    tone: () => {
      alternate = !alternate
      return alternate ? 'surface' : 'light'
    },
  }
  const body = linkReferences(
    pages.map((page) => DESIGN[page.design](page.sections, ctx)).join('\n'),
    sources
  )
  if (results.length) nav.push({ id: 'results', title: 'Key results' })
  if (sources.length) nav.push({ id: 'sources', title: 'Sources' })
  const name = title || brand.name
  const wordmark = `<span class="brand">${brand.logo?.kind === 'text' ? '<span class="hex" aria-hidden="true"></span>' : ''}${esc(brand.name)}</span>`
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none';img-src data:;style-src 'unsafe-inline';font-src data:;base-uri 'none';form-action 'none'" />
<meta name="generator" content="${WEB_RENDERER_VERSION}" />
<title>${esc(name)}</title>
<style>${await fontFaces(brand)}${css(brand)}</style>
</head>
<body id="top" data-brand="${esc(brand.id)}@${brand.version}">
${preview ? '<p class="preview">PREVIEW · NOT APPROVED FOR FINAL EXPORT</p>' : ''}
<nav class="top" aria-label="Sections"><div class="wrap"><a class="brand" href="#top">${brand.logo?.kind === 'text' ? '<span class="hex" aria-hidden="true"></span>' : ''}${esc(brand.name)}</a>${
    nav.length
      ? `<ul>${nav.map((item) => `<li><a href="#${item.id}">${esc(item.title)}</a></li>`).join('')}</ul>`
      : ''
  }</div></nav>
<main>
${body}
${results.length ? resultsSection(results) : ''}
${sourcesSection(sources)}
</main>
<footer class="foot"><div class="wrap">${wordmark}<span>${esc(name)}</span></div></footer>
</body>
</html>`
}
