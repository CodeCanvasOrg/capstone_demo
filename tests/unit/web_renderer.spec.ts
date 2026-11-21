import { test } from '@japa/runner'
import { renderWebHtml } from '#services/exports/web_renderer'
import { DESIGN_IDS } from '../../shared/brochure/designs.ts'
import { parsePages } from '../../shared/brochure/content.ts'
import { getBrandKit } from '../../shared/layout/brand.ts'
import type { ClientBlock } from '../../shared/publication/client.ts'

const brand = getBrandKit('humblebee')!
const text = (value: string) => [{ type: 'text' as const, text: value }]
const p = (value: string) => ({ type: 'paragraph' as const, content: text(value) })
const h = (level: 2 | 3, value: string): ClientBlock => ({
  type: 'heading',
  level,
  content: text(value),
})
const ul = (...items: string[]): ClientBlock => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [p(item)] })),
})

/** Content shaped for every design at once: sections, a stat, cards, bullets and a source. */
const client = {
  title: 'Entry <title>',
  summary: p('A one line summary.'),
  body: [
    h(2, 'Section one'),
    p('42% — of teams adopted it'),
    p('Intro paragraph with a reference'),
    ul('Bullet alpha', 'Bullet beta'),
    h(3, 'Card one'),
    p('12x — faster'),
    p('Card one body'),
    h(3, 'Card two'),
    ul('Card two bullet'),
    p('Source: Survey 2026'),
    h(2, 'Section two'),
    ul('Speed: fast | slow', 'Cost: low | high'),
    h(3, 'Card three'),
    p('Card three body'),
  ] as ClientBlock[],
  sources: [],
}

test.group('Web page renderer', () => {
  for (const design of DESIGN_IDS) {
    test(`the ${design} design shows every word of the page`, async ({ assert }) => {
      const pages = parsePages(client)
      const html = await renderWebHtml(
        pages.map((sections) => ({ design, sections })),
        brand,
        { title: client.title }
      )
      const body = html.slice(html.indexOf('<main>'), html.indexOf('</main>'))
      const words = [
        'Entry &lt;title&gt;',
        'A one line summary.',
        'Section one',
        '42%',
        'of teams adopted it',
        'Intro paragraph with a reference',
        'Bullet alpha',
        'Bullet beta',
        'Card one',
        '12x',
        'Card one body',
        'Card two',
        'Card two bullet',
        'Survey 2026',
        'Section two',
        'Card three',
        'Card three body',
      ]
      for (const word of words) assert.include(body, word, `${design} dropped "${word}"`)
      // The comparison rows show either as a table (glance) or as bullets.
      for (const cell of ['Speed', 'fast', 'slow', 'Cost', 'low', 'high'])
        assert.include(body, cell, `${design} dropped "${cell}"`)
    })
  }

  test('the page is self-contained and loads nothing', async ({ assert }) => {
    const html = await renderWebHtml(
      parsePages(client).map((sections, i) => ({
        design: i ? ('article' as const) : ('cover' as const),
        sections,
      })),
      brand
    )
    assert.include(html, "default-src 'none'")
    assert.include(html, 'name="viewport"')
    assert.notMatch(html, /<script/i)
    assert.notMatch(html, /(src|href)="(https?:)?\/\//i)
    assert.notMatch(html, /url\((?!data:)/)
  })

  test('escapes text and titles', async ({ assert }) => {
    const html = await renderWebHtml(
      [{ design: 'cover', sections: parsePages({ ...client, body: [] })[0] }],
      brand,
      { title: '<img src=x onerror=alert(1)>' }
    )
    assert.notInclude(html, '<img src=x')
    assert.include(html, '<title>&lt;img src=x onerror=alert(1)&gt;</title>')
  })

  test('references link to their listed source and sources get anchors', async ({ assert }) => {
    const body: ClientBlock[] = [
      {
        type: 'paragraph',
        content: [
          ...text('Claim'),
          { type: 'reference', number: 1 },
          { type: 'reference', number: 9 },
        ],
      },
    ]
    const html = await renderWebHtml(
      [{ design: 'article', sections: parsePages({ title: 'T', body })[0] }],
      brand,
      { sources: [{ number: 1, label: 'Report <a>', page: 3 }] }
    )
    assert.include(html, '<sup class="ref"><a href="#src-1" aria-label="Source 1">1</a></sup>')
    // An unlisted number stays a plain marker rather than a broken link.
    assert.include(html, '<sup class="ref">9</sup>')
    assert.include(html, '<li id="src-1" value="1">Report &lt;a&gt;, p. 3</li>')
    assert.include(html, 'href="#sources"')
  })

  test('key results show their qualifier as text', async ({ assert }) => {
    const html = await renderWebHtml(
      [{ design: 'cover', sections: parsePages({ title: 'T', body: [] })[0] }],
      brand,
      {
        results: [{ value: '30%', qualifier: 'estimated', units: 'cost', period: 'FY26' } as never],
      }
    )
    assert.include(html, '30%')
    assert.include(html, '<p class="q">Estimated</p>')
    assert.include(html, 'cost; FY26')
  })

  test('the draft banner shows only on previews', async ({ assert }) => {
    const pages = [{ design: 'cover' as const, sections: parsePages({ title: 'T', body: [] })[0] }]
    assert.include(await renderWebHtml(pages, brand, { preview: true }), 'PREVIEW · NOT APPROVED')
    assert.notInclude(await renderWebHtml(pages, brand), 'PREVIEW · NOT APPROVED')
  })
})
