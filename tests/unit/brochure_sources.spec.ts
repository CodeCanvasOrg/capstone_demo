import { test } from '@japa/runner'
import { renderBrochureHtml } from '#services/exports/brochure_renderer'
import { getBrandKit } from '../../shared/layout/brand.ts'

const none = { paragraphs: [], lists: [], bullets: [], groups: [], extra: [] }
const pages = [{ design: 'cover' as const, sections: [{ ...none, title: 'Entry' }] }]

test.group('Brochure sources', () => {
  test('every brochure ends with its sources on their own sheet', async ({ assert }) => {
    const html = await renderBrochureHtml(pages, getBrandKit('humblebee')!, {
      sources: [
        { number: 1, label: 'Annual report.pdf', page: 4 },
        { number: 2, label: 'Interview <notes>' },
      ],
    })
    const body = html.slice(html.indexOf('<body>'), html.indexOf('</body>'))
    const at = body.indexOf('<section class="sheet refs">')
    assert.isAbove(at, body.indexOf('class="sheet cover'))
    assert.equal(body.lastIndexOf('<section'), at)
    assert.include(body, '<li value="1">Annual report.pdf, p. 4</li>')
    assert.include(body, '<li value="2">Interview &lt;notes&gt;</li>')
  })

  test('no sources sheet when nothing was cited', async ({ assert }) => {
    const html = await renderBrochureHtml(pages, getBrandKit('humblebee')!)
    assert.notInclude(html, 'class="sheet refs"')
  })
})
