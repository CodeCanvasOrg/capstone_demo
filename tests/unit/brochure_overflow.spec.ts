/// <reference lib="dom" />
import { test } from '@japa/runner'
import { chromium } from 'playwright'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import { renderBrochureHtml } from '#services/exports/brochure_renderer'
import { documentFromPages, parsePages, validatePage } from '../../shared/brochure/content.ts'
import { DESIGN_IDS, type DesignId } from '../../shared/brochure/designs.ts'
import { getBrandKit } from '../../shared/layout/brand.ts'
import { maxPage } from '../fixtures/brochure/max.ts'
import { samples } from '../fixtures/brochure/pages.ts'

/**
 * Real Chromium. Every design filled to its limits must keep its text on the
 * sheet and clear of other text. Opt in with LAYOUT_NATIVE_PDF=1, like the other
 * native layout checks.
 */
const enabled = process.env.LAYOUT_NATIVE_PDF === '1'

type Issue = { design: string; kind: string; text: string }

async function measure(design: DesignId) {
  const pages = [samples.cover, maxPage(design)]
  const { document: doc } = documentFromPages(pages)
  const { client } = new PublicationProjectionService().project(doc as never)
  const parsed = parsePages(client)
  const html = await renderBrochureHtml(
    parsed.map((sections, index) => ({ design: index ? design : 'cover', sections })),
    getBrandKit('humblebee')!
  )
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } })
    await page.setContent(html)
    await page.evaluate(() => document.fonts.ready)
    return (await page.evaluate((name) => {
      const sheet = document.querySelectorAll('.sheet')[1] as HTMLElement
      const box = sheet.getBoundingClientRect()
      const mm = box.width / 210
      const issues: Issue[] = []
      const leaves = [...sheet.querySelectorAll<HTMLElement>('*')].filter(
        (el) =>
          [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) &&
          getComputedStyle(el).visibility !== 'hidden'
      )
      const rect = (el: HTMLElement) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        return range.getBoundingClientRect()
      }
      for (const el of leaves) {
        const r = rect(el)
        const text = el.textContent!.trim().slice(0, 40)
        if (r.bottom > box.bottom - 6 * mm)
          issues.push({ design: name, kind: 'below the page margin', text })
        if (r.right > box.right - 6 * mm)
          issues.push({ design: name, kind: 'past the right margin', text })
        if (r.left < box.left + 6 * mm)
          issues.push({ design: name, kind: 'past the left margin', text })
      }
      for (let i = 0; i < leaves.length; i++)
        for (let j = i + 1; j < leaves.length; j++) {
          if (leaves[i].contains(leaves[j]) || leaves[j].contains(leaves[i])) continue
          const a = rect(leaves[i])
          const b = rect(leaves[j])
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (w > 2 && h > 2)
            issues.push({
              design: name,
              kind: 'overlaps other text',
              text: `${leaves[i].tagName}.${leaves[i].className} "${leaves[i].textContent!.trim().slice(0, 18)}" / ${leaves[j].tagName}.${leaves[j].className} "${leaves[j].textContent!.trim().slice(0, 18)}"`,
            })
        }
      return issues
    }, design)) as Issue[]
  } finally {
    await browser.close()
  }
}

test.group('Brochure designs at their limits', () => {
  test('every maximum page is within its own limits', ({ assert }) => {
    for (const id of DESIGN_IDS) assert.deepEqual(validatePage(id, maxPage(id)), [], id)
  })

  for (const id of DESIGN_IDS)
    test(`${id}: nothing runs off the sheet or collides`, async ({ assert }) => {
      assert.deepEqual(await measure(id), [])
    }).skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run the Chromium layout checks')
})
