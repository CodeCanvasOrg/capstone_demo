import { test } from '@japa/runner'
import { renderPageHtml, ribbonsSvg, type PageContext } from '#services/exports/collection_html'
import { renderLayoutHtml } from '#services/exports/layout_renderer'
import { buildManifest, type CollectionEntry } from '../../shared/layout/collection.ts'
import { getBrandKit } from '../../shared/layout/brand.ts'
import { planLayout } from '../../shared/layout/plan.ts'
import {
  planPages,
  rulesDesign,
  type PageSpec,
  type PlannedPage,
} from '../../shared/layout/portfolio.ts'
import { getTemplate, resolveOptions } from '../../shared/layout/templates.ts'
import * as fx from '../fixtures/layout/entries.ts'

const brand = getBrandKit('humblebee')!
const entry = (id: string, extra: Partial<CollectionEntry> = {}): CollectionEntry => ({
  entryId: id,
  revisionId: `${id}-r1`,
  title: `Entry ${id}`,
  category: 'Logistics',
  templateId: 'case_study_standard',
  templateVersion: 1,
  pages: 1,
  evidenceKeys: [],
  ...extra,
})

const render = (spec: PageSpec, entries: CollectionEntry[], extra = {}) => {
  const manifest = buildManifest({
    name: 'Selected <work>',
    entries,
    wrapper: { about: 'We build document AI.\n\nSecond paragraph.', ...extra },
    brand: { id: 'humblebee', version: 1 },
  })
  const design = { source: 'custom' as const, pages: [spec] }
  const page: PlannedPage = { id: spec.id, kind: spec.kind, start: 1, count: 1, spec }
  const rows = planPages(rulesDesign(entries, {}, 'classic'), entries).rows
  const ctx: PageContext = { manifest, brand, rows }
  void design
  return renderPageHtml(page, ctx)
}

test.group('Portfolio page renderer', () => {
  test('ribbons are deterministic per name and differ between names', ({ assert }) => {
    assert.equal(ribbonsSvg('A', '#f6d900'), ribbonsSvg('A', '#f6d900'))
    assert.notEqual(ribbonsSvg('A', '#f6d900'), ribbonsSvg('B', '#f6d900'))
    assert.include(ribbonsSvg('A', '#f6d900'), 'stroke="#f6d900"')
  })

  test('the ribbon cover shows the name, the count and the brand, with the name escaped', async ({
    assert,
  }) => {
    const html = await render({ id: 'cover', kind: 'cover', variant: 'ribbons' }, [
      entry('a'),
      entry('b'),
    ])
    assert.include(html, 'Selected &lt;work&gt;')
    assert.notInclude(html, 'Selected <work>')
    assert.include(html, '2 case studies')
    assert.include(html, 'HumbleBee AI')
    assert.include(html, '<svg class="ribbons"')
  })

  test('a cover line the reviewer wrote replaces the default count', async ({ assert }) => {
    const html = await render(
      { id: 'cover', kind: 'cover', variant: 'panel', subtitle: 'Selected 2026' },
      [entry('a')]
    )
    assert.include(html, 'Selected 2026')
    assert.notInclude(html, '1 case study')
  })

  test('the statement uses the page text, then the company introduction', async ({ assert }) => {
    const fromAbout = await render({ id: 's', kind: 'statement', variant: 'panel' }, [entry('a')])
    assert.include(fromAbout, 'We build document AI.')
    assert.include(fromAbout, 'Second paragraph.')
    const own = await render(
      { id: 's', kind: 'statement', variant: 'plain', text: 'Our own words.' },
      [entry('a')]
    )
    assert.include(own, 'Our own words.')
    assert.notInclude(own, 'We build document AI.')
  })

  test('key numbers show each figure with its basis, escaped', async ({ assert }) => {
    const html = await render(
      {
        id: 'h',
        kind: 'highlights',
        variant: 'numbers',
        items: [
          { value: '40%', label: 'faster <review>', qualifier: 'estimated' },
          { value: '3x', label: 'throughput' },
        ],
      },
      [entry('a')]
    )
    assert.include(html, '40%')
    assert.include(html, 'faster &lt;review&gt;')
    assert.include(html, 'Estimated')
    assert.equal((html.match(/class="stat"/g) ?? []).length, 2)
  })

  test('section openers show the title and optional line', async ({ assert }) => {
    const html = await render(
      { id: 'sec', kind: 'section', variant: 'bold', title: 'Logistics', text: 'Tight deadlines.' },
      [entry('a')]
    )
    assert.include(html, 'Logistics')
    assert.include(html, 'Tight deadlines.')
  })

  test('card contents show category, title and page for every entry, eight to a sheet', async ({
    assert,
  }) => {
    const entries = Array.from({ length: 10 }, (_, i) => entry(`e${i}`, { title: `Title ${i}` }))
    const html = await render({ id: 'c', kind: 'contents', variant: 'cards' }, entries)
    assert.equal((html.match(/class="sheet contents"/g) ?? []).length, 2)
    assert.equal((html.match(/class="card"/g) ?? []).length, 10)
    assert.include(html, 'Title 9')
    assert.include(html, 'Logistics')
  })

  test('list contents sheets match the planner for any entry count', async ({ assert }) => {
    for (const n of [1, 15, 31, 32, 33, 70, 100]) {
      const entries = Array.from({ length: n }, (_, i) =>
        entry(`e${i}`, { category: i % 3 === 0 ? 'One' : i % 3 === 1 ? 'Two' : 'Three' })
      )
      const design = rulesDesign(entries, {}, 'classic')
      const planned = planPages(design, entries).contentsPages
      const html = await render({ id: 'c', kind: 'contents', variant: 'list' }, entries)
      assert.equal((html.match(/class="sheet contents"/g) ?? []).length, planned, `${n} entries`)
    }
  })

  test('contact shows only details that exist and never invents any', async ({ assert }) => {
    const none = await render({ id: 'x', kind: 'contact', variant: 'dark' }, [entry('a')])
    // The CSS contains "@", so look at the contact block itself: it is empty.
    assert.include(none, '<div class="how"></div>')
    const some = await render(
      { id: 'x', kind: 'contact', variant: 'light', text: 'Talk to us' },
      [entry('a')],
      {
        contact: { email: 'hi@example.com' },
      }
    )
    assert.include(some, 'hi@example.com')
    assert.include(some, 'Talk to us')
  })

  test('entries are the document exporter’s job, not this renderer’s', async ({ assert }) => {
    await assert.rejects(() => render({ id: 'e', kind: 'entry', entryId: 'a' }, [entry('a')]))
  })
})

test.group('Brochure look for entries', () => {
  const standard = getTemplate('case_study_standard')!
  const html = (options = {}) =>
    renderLayoutHtml(planLayout(fx.brandedClient, standard, brand, options), brand)

  test('the classic look carries no brochure styling at all', async ({ assert }) => {
    for (const options of [{}, { look: 'classic' }]) {
      const out = await html(options)
      assert.notInclude(out, 'data-look')
      assert.notInclude(out, 'brochure')
    }
  })

  test('the brochure look adds its own marker and styles, and larger title and figures', async ({
    assert,
  }) => {
    const classic = await html()
    const brochure = await html({ look: 'brochure' })
    assert.include(brochure, 'data-look="brochure"')
    assert.include(brochure, 'article[data-look="brochure"] .hero')
    assert.include(brochure, 'repeating-radial-gradient')
    assert.notEqual(classic, brochure)
    const size = (out: string) => Number(/#hero h1\{font-size:([\d.]+)pt\}/.exec(out)![1])
    assert.isAbove(size(brochure), size(classic))
  })

  test('look is validated, and classic is not stored so existing hashes are unchanged', ({
    assert,
  }) => {
    const template = getTemplate('case_study_standard')!
    assert.deepEqual(resolveOptions(template, {}).options, { imageMode: 'auto' })
    assert.deepEqual(resolveOptions(template, { look: 'classic' }).options, { imageMode: 'auto' })
    assert.deepEqual(resolveOptions(template, { look: 'brochure' }).options, {
      imageMode: 'auto',
      look: 'brochure',
    })
    const bad = resolveOptions(template, { look: 'neon' })
    assert.equal(bad.errors[0].code, 'invalid_option_value')
    assert.equal(bad.errors[0].field, 'look')
  })
})
