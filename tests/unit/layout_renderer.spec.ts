import { test } from '@japa/runner'
import ExportPdfService from '#services/exports/pdf_service'
import { renderLayoutHtml } from '#services/exports/layout_renderer'
import { planLayout } from '../../shared/layout/plan.ts'
import { fitPlan } from '../../shared/layout/fit.ts'
import { getTemplate } from '../../shared/layout/templates.ts'
import { getBrandKit } from '../../shared/layout/brand.ts'
import * as fx from '../fixtures/layout/entries.ts'

const brand = getBrandKit('humblebee')!
const standard = getTemplate('case_study_standard')!
const concise = getTemplate('case_study_concise')!
const render = (data = fx.entry01, template = standard, options = {}, html = {}) =>
  renderLayoutHtml(planLayout(data, template, brand, options), brand, html)

test.group('Layout renderer (RND-01)', () => {
  test('uses brand tokens and embeds the font as data, never a remote URL', async ({ assert }) => {
    const html = await render()
    assert.include(html, brand.palette.primary)
    assert.include(html, brand.palette.accent)
    assert.match(html, /@font-face[^}]+data:font\/woff2/)
    assert.notMatch(html, /https?:\/\/[^"')\s]*\.(woff2?|ttf|css)/)
    assert.notMatch(html, /<link[^>]+href=/)
  })

  test('renders superscript references and a compact source block', async ({ assert }) => {
    const html = await render()
    assert.match(html, /<sup class="ref">1<\/sup>/)
    assert.include(html, 'Customs brief, p. 2')
    assert.notMatch(html, /chunk/i)
  })

  test('result row shows value, "Up to" and the visible qualifier label', async ({ assert }) => {
    const html = await render()
    assert.match(html, /class="stat-value">42%</)
    assert.match(html, /Up to[^<]*<[^>]*>[^<]*30%|30%/)
    assert.include(html, 'Measured')
    assert.include(html, 'Estimated')
  })

  test('empty optional blocks leave no markup or reserved whitespace', async ({ assert }) => {
    const html = await render(fx.sparse)
    for (const cls of ['stat-row', 'figure', 'cta', 'sources']) {
      assert.notInclude(html, `class="${cls}"`)
    }
    assert.notInclude(html, 'class="results"')
  })

  test('no-image variant renders no <img>; image variant renders the figure with its caption', async ({
    assert,
  }) => {
    assert.notInclude(await render(fx.noImage), '<img')
    const withImage = await render(fx.entry01)
    assert.include(withImage, '<figure')
    assert.include(withImage, '<figcaption')
  })

  test('draft watermark is the only difference between preview and final output', async ({
    assert,
  }) => {
    const draft = await render(fx.entry01, standard, {}, { preview: true })
    const final = await render(fx.entry01, standard, {}, { preview: false })
    assert.include(draft, 'NOT APPROVED')
    assert.notInclude(final, 'NOT APPROVED')
    const strip = (s: string) => s.replace(/<p class="draft-banner">[\s\S]*?<\/p>/, '')
    assert.equal(strip(draft), strip(final))
  })

  test('page-break rules keep headings, result labels and captions with their content', async ({
    assert,
  }) => {
    const html = await render()
    assert.match(html, /h2[^{]*\{[^}]*break-after:\s*avoid/)
    assert.match(html, /\.stat[^{]*\{[^}]*break-inside:\s*avoid/)
    assert.match(html, /figure[^{]*\{[^}]*break-inside:\s*avoid/)
  })

  test('a CTA is rendered only with a safe supplied link', async ({ assert }) => {
    const html = await render(fx.entry01, standard, {
      cta: { label: 'Talk to us', href: 'https://example.com/contact' },
    })
    assert.include(html, 'href="https://example.com/contact"')
    assert.include(html, 'Talk to us')
  })

  test('hostile text is escaped', async ({ assert }) => {
    const html = await render({ ...fx.entry01, title: '<script>alert(1)</script>' })
    assert.notInclude(html, '<script>alert(1)</script>')
    assert.include(html, '&lt;script&gt;')
  })

  test('the compact density from fitting changes only spacing, never text', async ({ assert }) => {
    const plan = fitPlan(planLayout(fx.entry01, concise, brand, {}), concise, {
      measure: (p) => (p.density === 'compact' ? 0.9 : 1.05),
    }).plan
    const compact = await renderLayoutHtml(plan, brand, {})
    const normal = await render(fx.entry01, concise)
    assert.include(compact, 'data-density="compact"')
    const text = (s: string) =>
      s.replace(/<style>[\s\S]*?<\/style>/, '').replace(/ data-density="\w+"/, '')
    assert.equal(text(compact), text(normal).replace('data-density="normal"', ''))
  })

  test('ExportPdfService.html accepts a layout plan and rejects non-client data', async ({
    assert,
  }) => {
    const plan = planLayout(fx.entry01, standard, brand, {})
    const html = await ExportPdfService.html(fx.entry01, { layout: plan })
    assert.include(html, 'data-template="case_study_standard"')
    await assert.rejects(() =>
      ExportPdfService.html({ ...fx.entry01, reviewerNotes: ['secret'] } as never, { layout: plan })
    )
  })
})
