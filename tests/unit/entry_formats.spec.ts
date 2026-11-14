import { test } from '@japa/runner'
import { renderLayoutHtml } from '#services/exports/layout_renderer'
import OutlineTemplateService from '#services/documents/outline_template_service'
import {
  entrySchemaFor,
  entryToDocument,
  validateEntry,
  entryLimitsFor,
} from '../../shared/layout/entry.ts'
import { FORMAT_HEADINGS, FORMAT_KICKER, type EntryFormat } from '../../shared/layout/formats.ts'
import { sectionRoles } from '../../shared/layout/pages.ts'
import { planLayout } from '../../shared/layout/plan.ts'
import { getTemplate } from '../../shared/layout/templates.ts'
import { getBrandKit } from '../../shared/layout/brand.ts'
import { parseClientRenderData, type ClientBlock } from '../../shared/publication/client.ts'
import { FORMAT_PROTOCOL } from '../../app/services/documents/branded_entry_prompt.ts'

const brand = getBrandKit('humblebee')!
const standard = getTemplate('case_study_standard')!

const base = {
  doc_type: 'client_case_study' as const,
  hero: { headline: 'A headline', subhead: 'One sentence about the work.' },
  results: [] as any[],
  challenge: { text: 'The problem in a sentence.', footnote_ids: [] },
  solution: { text: 'What was built.', footnote_ids: [] },
  steps: [
    { title: 'Ingest', text: 'Events arrive.' },
    { title: 'Queue', text: 'Work is buffered.' },
    { title: 'Serve', text: 'Results are returned.' },
  ],
  capabilities: [
    { title: 'Streaming', text: 'Processes events as they arrive.' },
    { title: 'Backpressure', text: 'Slows producers instead of dropping work.' },
  ],
  footnotes: [],
  reviewer_notes: [],
}
const entries: Record<EntryFormat, any> = {
  case_study: base,
  portfolio: {
    ...base,
    results: [
      { value: '40%', label: 'faster onboarding', evidence: 'client_reported', footnote_ids: [] },
    ],
    roadmap: 'Mobile access is planned.',
  },
  technical: {
    ...base,
    capabilities: [
      ...base.capabilities,
      { title: 'Replay', text: 'Failed batches can be replayed.' },
    ],
    results: [
      { value: '120 ms', label: 'p95 latency at 50 users', evidence: 'measured', footnote_ids: [] },
    ],
    limitations: 'Only one workload was tested; failover was not measured.',
  },
  vision: {
    ...base,
    steps: base.steps,
    capabilities: [
      { title: 'Search', text: 'Find any record.', status: 'delivered' },
      { title: 'Assistants', text: 'Draft replies.', status: 'pilot' },
      { title: 'Automation', text: 'Run routine work.', status: 'planned' },
    ],
    roadmap_items: [
      { when: 'Now', text: 'Search is live for early users.' },
      { when: 'Next', text: 'Assistants leave pilot.' },
      { when: 'Later', text: 'Routine work is automated.' },
    ],
  },
}

const build = (format: EntryFormat) =>
  entryToDocument(entrySchemaFor(format).parse(entries[format]), {
    allowedChunkIds: new Set(),
    format,
  })

const text = (node: any): string =>
  node.type === 'text' ? node.text : (node.content ?? []).map(text).join('')

/** The saved TipTap blocks as the client DTO the layout planner reads. */
function client(format: EntryFormat) {
  const { document } = build(format)
  const entry = entries[format]
  const toClient = (node: any): ClientBlock =>
    node.type === 'heading'
      ? ({ type: 'heading', level: node.attrs.level, content: node.content } as ClientBlock)
      : node.type === 'paragraph'
        ? ({ type: 'paragraph', content: node.content } as ClientBlock)
        : ({
            type: node.type,
            content: node.content.map((li: any) => ({
              type: 'listItem',
              content: li.content.map(toClient),
            })),
          } as ClientBlock)
  const [title, summary, ...body] = document.content
  return parseClientRenderData({
    schemaVersion: 1,
    docType: 'case_study',
    ...(format === 'case_study' ? {} : { format }),
    title: text(title),
    summary: toClient(summary),
    body: body.map(toClient),
    results: entry.results.map((r: any) => ({
      value: r.value,
      qualifier: r.evidence,
      units: r.label,
    })),
    sources: [],
  })
}

const headings = (format: EntryFormat) =>
  build(format)
    .document.content.filter((node: any) => node.type === 'heading' && node.attrs.level === 2)
    .map(text)

test.group('Entry formats: generated sections', () => {
  test('each format writes its own headings in its own order', ({ assert }) => {
    const h = FORMAT_HEADINGS
    assert.deepEqual(headings('portfolio'), [
      h.portfolio.results,
      h.portfolio.challenge,
      h.portfolio.solution,
      h.portfolio.capabilities,
      h.portfolio.steps,
      h.portfolio.roadmap,
    ])
    assert.deepEqual(headings('technical'), [
      h.technical.challenge,
      h.technical.solution,
      h.technical.steps,
      h.technical.capabilities,
      h.technical.results,
      h.technical.roadmap,
    ])
    assert.deepEqual(headings('vision'), [
      h.vision.challenge,
      h.vision.solution,
      h.vision.steps,
      h.vision.capabilities,
      h.vision.roadmap,
    ])
  })

  test('every written heading is recognised as a section role in the editor', ({ assert }) => {
    for (const format of ['portfolio', 'technical', 'vision'] as const) {
      const blocks = build(format).document.content.map((node: any) => ({
        type: node.type,
        level: node.attrs?.level,
        text: text(node),
      }))
      const roles = sectionRoles(blocks)
      for (const [i, block] of blocks.entries())
        if (block.type === 'heading' && block.level === 2)
          assert.isNotNull(roles[i], `${format}: "${block.text}" has no role`)
    }
  })

  test('the sidecar records the format; the case study is the default', ({ assert }) => {
    assert.equal(build('technical').sidecar.format, 'technical')
    assert.equal(build('case_study').sidecar.format, 'case_study')
  })

  test('vision capabilities carry their availability and the roadmap is a list', ({ assert }) => {
    const { document } = build('vision')
    const list = document.content.find((node: any) => node.type === 'bulletList') as any
    assert.match(text(list.content[0]), /^\[Delivered\] Search — /)
    assert.match(text(list.content[1]), /^\[Pilot\] /)
    const roadmap = document.content.at(-1) as any
    assert.equal(roadmap.type, 'orderedList')
    assert.equal(text(roadmap.content[0]), 'Now — Search is live for early users.')
  })

  test('technical limitations are written under their own heading', ({ assert }) => {
    const { document } = build('technical')
    assert.equal(text(document.content.at(-2)), 'Limitations')
    assert.include(text(document.content.at(-1)), 'failover was not measured')
  })

  test('a vision reports no outcomes and the formats cap what they can fit', ({ assert }) => {
    const limits = entryLimitsFor(undefined, 'vision')
    const withResults = entrySchemaFor('vision').parse({
      ...entries.vision,
      results: entries.technical.results,
    })
    assert.include(
      validateEntry(withResults, limits).map((p) => p.field),
      'results'
    )
    assert.equal(entryLimitsFor(undefined, 'technical').capabilities, 4)
    assert.equal(entryLimitsFor({ pageBudget: 1 }, 'technical').capabilities, 3)
  })

  test('only the structured templates carry a format, and legacy keeps its outline', async ({
    assert,
  }) => {
    const service = new OutlineTemplateService()
    for (const id of ['portfolio', 'technical', 'vision'] as const) {
      const { definition: structured } = await service.resolve(id)
      assert.equal(structured.format, 'branded_entry')
      assert.equal(structured.entryFormat, id)
      assert.include(structured.instructions, 'The application lays it out')
      const { definition: legacy } = await service.resolve(id, { legacy: true })
      assert.isUndefined(legacy.format)
      assert.isUndefined(legacy.entryFormat)
    }
    for (const format of ['portfolio', 'technical', 'vision'] as const)
      assert.include(FORMAT_PROTOCOL[format], `Format: `)
  })
})

test.group('Entry formats: layout plan', () => {
  const plan = (format: EntryFormat) => planLayout(client(format), standard, brand, {})
  const types = (format: EntryFormat) => plan(format).blocks.map((b) => b.type)

  test('the hero kicker names the format', ({ assert }) => {
    for (const format of ['case_study', 'portfolio', 'technical', 'vision'] as const) {
      const hero = plan(format).blocks[0] as any
      assert.equal(hero.kicker, FORMAT_KICKER[format])
      assert.equal(plan(format).format, format)
    }
  })

  test('portfolio keeps the results band under the hero', ({ assert }) => {
    assert.deepEqual(types('portfolio'), [
      'hero',
      'results',
      'columns',
      'capabilities',
      'steps',
      'roadmap',
    ])
  })

  test('technical reads top to bottom and puts the evaluation where its section is', ({
    assert,
  }) => {
    assert.deepEqual(types('technical'), [
      'hero',
      'columns',
      'steps',
      'capabilities',
      'results',
      'roadmap',
    ])
  })

  test('vision has capabilities with status and a roadmap timeline', ({ assert }) => {
    assert.deepEqual(types('vision'), ['hero', 'columns', 'steps', 'capabilities', 'roadmap'])
    const blocks = plan('vision').blocks as any[]
    const caps = blocks.find((b) => b.type === 'capabilities')
    assert.deepEqual(
      caps.items.map((i: any) => i.status),
      ['delivered', 'pilot', 'planned']
    )
    assert.equal(caps.items[0].title, 'Search')
    const roadmap = blocks.find((b) => b.type === 'roadmap')
    assert.deepEqual(
      roadmap.items.map((i: any) => i.title),
      ['Now', 'Next', 'Later']
    )
  })

  test('an author who rewords a heading keeps the design while it still matches', ({ assert }) => {
    const data = client('technical')
    const body = data.body.map((block) =>
      block.type === 'heading' && (block.content?.[0] as any)?.text === 'Architecture'
        ? ({ ...block, content: [{ type: 'text', text: 'Architecture overview' }] } as ClientBlock)
        : block
    )
    const out = planLayout({ ...data, body }, standard, brand, {})
    assert.include(
      out.blocks.map((b) => b.type),
      'steps'
    )
  })
})

test.group('Entry formats: rendered design', () => {
  const render = (format: EntryFormat) =>
    renderLayoutHtml(planLayout(client(format), standard, brand, {}), brand)

  test('every format stamps itself on the article and uses only brand colours', async ({
    assert,
  }) => {
    const allowed = new Set(
      [...Object.values(brand.palette), '#fff', '#ffffff', '#d5dbe6', '#b42318'].map((c) =>
        c.toLowerCase()
      )
    )
    for (const format of ['portfolio', 'technical', 'vision'] as const) {
      const html = await render(format)
      assert.include(html, `data-format="${format}"`)
      assert.include(html, FORMAT_KICKER[format])
      const hex = (html.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []).map((c) => c.toLowerCase())
      assert.deepEqual(
        [...new Set(hex.filter((c) => !allowed.has(c)))],
        [],
        `${format} uses a colour outside the brand kit`
      )
    }
  })

  test('technical renders the evaluation as a table and the architecture as a pipeline', async ({
    assert,
  }) => {
    const html = await render('technical')
    assert.match(html, /<table class="metrics"[^>]*>[\s\S]*<td class="m-value">120 ms/)
    assert.notInclude(html, 'class="stat-band"')
    assert.match(html, /\.step:not\(:last-child\)::after/)
    assert.match(html, /class="roadmap-label">Limitations</)
  })

  test('vision renders availability chips and a timeline', async ({ assert }) => {
    const html = await render('vision')
    assert.include(html, 'class="chip chip-delivered">Delivered<')
    assert.include(html, 'class="chip chip-pilot">Pilot<')
    assert.include(html, 'class="chip chip-planned">Planned<')
    assert.match(html, /<section class="timeline"[^>]*--n:3[\s\S]*class="tl-when">Now</)
    assert.match(html, /linear-gradient\(135deg/)
  })

  test('portfolio is a light page with the accent rule, not a navy band', async ({ assert }) => {
    const html = await render('portfolio')
    assert.match(html, /data-format="portfolio"\] \.hero\{background:#fff/)
    assert.include(html, 'class="stat-band"')
  })

  test('the case study design is untouched', async ({ assert }) => {
    const html = await render('case_study')
    assert.include(html, 'data-format="case_study"')
    assert.notMatch(html, /data-format="case_study"\] \./)
  })
})
