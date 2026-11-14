import type { BrandKit } from '../../../shared/layout/brand.ts'
import type { Manifest } from '../../../shared/layout/collection.ts'
import { esc } from '#services/exports/client_blocks'
import { fontFaces, PAGE_MARGIN_MM } from '#services/exports/layout_renderer'

type ContentsRow = { entryId: string; title: string; category: string; page: number }

/**
 * The collection's own pages: cover, introduction, contents and back cover.
 * Only wrapper copy the reviewer supplied is shown. Contact falls back to the
 * brand kit, and a missing contact leaves the back cover without one rather
 * than inventing it. The entry count is described as case studies, not as
 * delivered projects.
 */
const css = (brand: BrandKit, full: boolean) => {
  const p = brand.palette
  return `
@page{size:A4;margin:${full ? 0 : PAGE_MARGIN_MM}mm}
*{box-sizing:border-box}
body{margin:0;font-family:"${brand.fonts[0]?.family ?? 'Arial'}",Arial,sans-serif;color:${p.text};font-size:10.5pt;line-height:1.55}
.page{break-after:page;min-height:calc(297mm - ${PAGE_MARGIN_MM * 2}mm - 2mm)}
.page:last-child{break-after:auto}
.cover{display:flex;flex-direction:column;justify-content:space-between;border-top:8px solid ${p.accent};padding-top:14mm}
.wordmark{font-weight:800;font-size:12pt;letter-spacing:.02em}
.cover h1{font-weight:800;font-size:34pt;line-height:1.12;margin:0 0 6mm;max-width:150mm}
.cover .meta{color:${p.muted};font-size:11pt}
h2{font-size:18pt;font-weight:800;margin:0 0 6mm;border-bottom:2px solid ${p.accent};padding-bottom:3mm}
.about p{font-size:12pt;margin:0 0 4mm;white-space:pre-line}
.group{margin:6mm 0 2mm;font-size:9pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${p.muted}}
.row{display:flex;gap:4mm;padding:2mm 0;border-bottom:1px solid #e5e7eb}
.row .t{flex:1}
.row .n{font-weight:700}
.back{display:flex;flex-direction:column;justify-content:flex-end;background:${p.primary};color:#fff;padding:${PAGE_MARGIN_MM}mm;height:296mm;break-after:auto}
.back .wordmark{font-size:16pt}
.back a{color:${p.accent};text-decoration:none}
.back p{margin:1mm 0}`
}

export async function renderWrapperHtml(
  part: 'cover' | 'about' | 'contents' | 'back',
  manifest: Manifest,
  brand: BrandKit,
  rows: ContentsRow[] = []
) {
  const name = manifest.name ?? 'Portfolio'
  const contact = { ...brand.contact, ...manifest.wrapper.contact }
  let body = ''
  if (part === 'cover')
    body = `<section class="page cover"><div class="wordmark">${esc(brand.name)}</div><div><h1>${esc(name)}</h1><div class="meta">${manifest.entries.length} case ${manifest.entries.length === 1 ? 'study' : 'studies'}</div></div><div></div></section>`
  if (part === 'about')
    body = `<section class="page about"><h2>About us</h2>${esc(manifest.wrapper.about ?? '')
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph}</p>`)
      .join('')}</section>`
  if (part === 'contents') {
    let last = ''
    const list = rows
      .map((row) => {
        const heading = row.category === last ? '' : `<div class="group">${esc(row.category)}</div>`
        last = row.category
        return `${heading}<div class="row"><span class="t">${esc(row.title)}</span><span class="n">${row.page}</span></div>`
      })
      .join('')
    body = `<section class="page"><h2>Contents</h2>${list}</section>`
  }
  if (part === 'back') {
    const lines = [contact.website, contact.email, contact.phone]
      .filter(Boolean)
      .map((line) => `<p>${esc(line!)}</p>`)
      .join('')
    body = `<section class="page back"><div class="wordmark">${esc(brand.name)}</div>${lines}</section>`
  }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><style>${await fontFaces(brand)}${css(brand, part === 'back')}</style></head><body>${body}</body></html>`
}
