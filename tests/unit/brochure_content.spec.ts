import { test } from '@japa/runner'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import {
  CAPS,
  brochureSchema,
  documentFromPages,
  parsePages,
  validatePage,
  type PageContent,
} from '../../shared/brochure/content.ts'
import {
  BROCHURE_TEMPLATES,
  DESIGNS,
  DESIGN_IDS,
  MAX_BROCHURE_PAGES,
  getBrochureTemplate,
  parseSelection,
  reviewSelection,
  templateSelection,
  type DesignId,
} from '../../shared/brochure/designs.ts'
import { samples } from '../fixtures/brochure/pages.ts'
import { BROCHURE_PROTOCOL, designGuide, planText } from '#services/documents/brochure_prompt'
import { isOpenPlan, resolveDesigns } from '../../shared/brochure/designs.ts'
import { lengthWarnings } from '../../shared/brochure/content.ts'

/** Through the real projection, exactly as a saved document reaches the renderer. */
const roundTrip = (pages: PageContent[]) => {
  const { document } = documentFromPages(pages)
  const { client } = new PublicationProjectionService().project(document as never)
  return parsePages(client)
}

test.group('Page designs and templates', () => {
  test('every design has a label, a description and a reason to choose it', ({ assert }) => {
    for (const id of DESIGN_IDS) {
      assert.isAbove(DESIGNS[id].label.length, 2)
      assert.isAbove(DESIGNS[id].description.length, 20)
      assert.isAbove(DESIGNS[id].bestFor.length, 20)
    }
  })

  test('the full templates only use known designs and start with a cover', ({ assert }) => {
    for (const template of BROCHURE_TEMPLATES) {
      assert.isTrue(template.pages.every((page) => DESIGN_IDS.includes(page)))
      assert.equal(template.pages[0], 'cover')
      assert.isAtMost(template.pages.length, MAX_BROCHURE_PAGES)
    }
    assert.deepEqual(getBrochureTemplate('brochure')!.pages, [...DESIGN_IDS])
  })

  test('choosing a template copies its pages, so editing one never changes the template', ({
    assert,
  }) => {
    const a = templateSelection('overview')!
    a.pages.push('article')
    assert.lengthOf(getBrochureTemplate('overview')!.pages, 5)
    assert.isUndefined(templateSelection('nope'))
  })

  test('a selection accepts designs and auto, and rejects everything else', ({ assert }) => {
    assert.isTrue(parseSelection({ source: 'custom', pages: ['cover', 'auto', 'contact'] }).ok)
    assert.isTrue(parseSelection({ source: 'ai', pages: ['auto'] }).ok)
    for (const value of [
      null,
      'x',
      [],
      { source: 'custom' },
      { source: 'custom', pages: [] },
      { source: 'hacker', pages: ['cover'] },
      { source: 'custom', pages: ['script'] },
      { source: 'custom', pages: ['cover'], extra: 1 },
      { source: 'custom', template: 'nope', pages: ['cover'] },
      { source: 'custom', pages: Array.from({ length: 13 }, () => 'article') },
    ])
      assert.isFalse(parseSelection(value).ok, JSON.stringify(value))
  })

  test('advice about the cover and contact is given, never enforced', ({ assert }) => {
    assert.deepEqual(
      reviewSelection({ source: 'custom', pages: ['cover', 'article', 'contact'] }),
      []
    )
    const notes = reviewSelection({
      source: 'custom',
      pages: ['article', 'cover', 'contact', 'article'],
    })
    assert.isTrue(notes.some((note) => /cover/i.test(note)))
    assert.isTrue(notes.some((note) => /contact/i.test(note)))
    assert.isTrue(
      reviewSelection({ source: 'custom', pages: ['cover', 'cover'] }).some((n) => /once/.test(n))
    )
    assert.deepEqual(reviewSelection({ source: 'ai', pages: ['auto', 'auto'] }), [])
  })
})

test.group('Page limits', () => {
  test('every sample page is within its design’s limits', ({ assert }) => {
    for (const id of DESIGN_IDS) assert.deepEqual(validatePage(id, samples[id]), [], id)
  })

  test('over-long and over-full pages are reported by path', ({ assert }) => {
    const page = structuredClone(samples.offer)
    page.sections[0].title = 'x'.repeat(80)
    page.sections[1].groups.pop()
    const problems = validatePage('offer', page, 3)
    assert.deepInclude(problems, { code: 'too_long', field: 'pages[3].sections[0].title' })
    assert.deepInclude(problems, { code: 'too_few', field: 'pages[3].sections[1].groups' })
  })

  test('a figure the design needs must be a real figure', ({ assert }) => {
    const page = structuredClone(samples.offer)
    page.sections[0].stat = { value: 'lots', label: 'of things' }
    assert.deepInclude(
      validatePage('offer', page).map((p) => p.field),
      'pages[0].sections[0].stat.value'
    )
    const proof = structuredClone(samples.proof)
    delete proof.sections[0].groups[0].stat
    assert.include(
      validatePage('proof', proof).map((p) => p.field),
      'pages[0].sections[0].groups[0].stat'
    )
  })

  test('content a design has no place for is refused, so a page cannot overflow its sheet', ({
    assert,
  }) => {
    const page = structuredClone(samples.cover)
    page.sections[0].bullets = ['one']
    page.sections[0].source = 'a source'
    page.sections.push({ paragraphs: [], bullets: [], groups: [] })
    const fields = validatePage('cover', page).map((p) => p.field)
    assert.include(fields, 'pages[0].sections[0].bullets')
    assert.include(fields, 'pages[0].sections[0].source')
    assert.include(fields, 'pages[0].sections')
  })

  test('every design has at least one section of caps', ({ assert }) => {
    for (const id of DESIGN_IDS) assert.isAbove(CAPS[id].length, 0)
  })
})

test.group('Page content as rich text', () => {
  test('the model’s output is a closed shape: unknown designs are rejected', ({ assert }) => {
    const ok = { pages: [samples.cover], reviewer_notes: [] }
    assert.isTrue(brochureSchema.safeParse(ok).success)
    assert.isFalse(
      brochureSchema.safeParse({
        pages: [{ ...samples.cover, design: 'script' }],
        reviewer_notes: [],
      }).success
    )
    assert.isFalse(brochureSchema.safeParse({ pages: [], reviewer_notes: [] }).success)
  })

  test('a document is ordinary rich text: headings, paragraphs, lists and page breaks', ({
    assert,
  }) => {
    const { document } = documentFromPages([samples.cover, samples.article])
    const types = document.content.map((node) => node.type)
    assert.equal(types[0], 'heading')
    assert.equal(document.content[0].attrs?.level, 1)
    assert.equal(types.filter((type) => type === 'horizontalRule').length, 1)
    assert.include(types, 'bulletList')
  })

  test('pages come back as pages, in order, split at the page break', ({ assert }) => {
    const pages = roundTrip(DESIGN_IDS.map((id) => samples[id]))
    assert.lengthOf(pages, DESIGN_IDS.length)
  })

  test('cover: title and subtitle', ({ assert }) => {
    const [cover] = roundTrip([samples.cover])
    assert.equal(cover[0].title, 'Powering faster customs clearance')
    assert.match(
      cover[0].paragraphs[0].content![0].type === 'text'
        ? (cover[0].paragraphs[0].content![0] as { text: string }).text
        : '',
      /customs brokers/
    )
  })

  test('proof: a figure and what it measures are separated, and the source line is kept apart', ({
    assert,
  }) => {
    const [, proof] = roundTrip([samples.cover, samples.proof])
    const section = proof[0]
    assert.equal(section.groups.length, 3)
    assert.deepEqual(
      section.groups.map((group) => [group.heading, group.stat]),
      [
        ['Faster', '40%'],
        ['Cleaner', '97%'],
        ['Wider', '12'],
      ]
    )
    assert.lengthOf(section.groups[0].paragraphs, 1)
    assert.equal(section.source, 'HumbleBee AI pilot report, 2026')
    assert.lengthOf(section.paragraphs, 2)
  })

  test('offer: one large figure in the first section, three columns in the second', ({
    assert,
  }) => {
    const [, offer] = roundTrip([samples.cover, samples.offer])
    assert.deepEqual(offer[0].stat, { value: '>30', label: 'brokerages evaluating the pipeline' })
    assert.equal(offer[1].title, 'What we offer')
    assert.lengthOf(offer[1].groups, 3)
  })

  test('glance: three sections, cards with bullets, and rows kept as text', ({ assert }) => {
    const [, glance] = roundTrip([samples.cover, samples.glance])
    assert.lengthOf(glance, 3)
    assert.lengthOf(glance[1].groups, 4)
    assert.deepEqual(glance[1].groups[0].bullets, ['Upload', 'Scan', 'Email intake'])
    assert.equal(glance[2].bullets[0], 'Architecture: Local | Modular | Scalable | Auditable')
    assert.equal(glance[2].groups[0].heading, 'What sets it apart')
  })

  test('article, columns, insight, recognition and contact keep their structure', ({ assert }) => {
    const pages = roundTrip(DESIGN_IDS.map((id) => samples[id]))
    const by = (id: DesignId) => pages[DESIGN_IDS.indexOf(id)]
    assert.lengthOf(by('article')[0].groups, 2)
    assert.lengthOf(by('article')[0].bullets, 3)
    assert.lengthOf(by('columns')[1].groups[0].bullets, 2)
    assert.lengthOf(by('insight')[0].groups, 3)
    assert.lengthOf(by('recognition')[1].groups, 3)
    assert.equal(by('contact')[0].groups[0].heading, 'Alex Rivera')
    assert.lengthOf(by('contact')[0].groups[0].paragraphs, 3)
    assert.lengthOf(by('contact'), 2)
  })

  test('an ordinary paragraph that merely starts with a number is not a figure', ({ assert }) => {
    const { document } = documentFromPages([
      {
        design: 'cover',
        sections: [
          {
            title: 'T',
            paragraphs: [{ text: '2026 is the year', chunks: [] }],
            bullets: [],
            groups: [],
          },
        ],
      },
    ])
    const { client } = new PublicationProjectionService().project(document as never)
    const [[section]] = parsePages(client)
    assert.isUndefined(section.stat)
  })

  test('chunk ids the application never supplied are dropped, never cited', ({ assert }) => {
    const page: PageContent = {
      design: 'cover',
      sections: [
        {
          title: 'T',
          paragraphs: [{ text: 'Text', chunks: ['real', 'invented'] }],
          bullets: [],
          groups: [],
        },
      ],
    }
    const result = documentFromPages([page], { allowedChunkIds: new Set(['real']) })
    assert.isTrue(result.dropped)
    const cited = JSON.stringify(result.document).match(/sourceChunkId":"([^"]+)/g)
    assert.deepEqual(cited, ['sourceChunkId":"real'])
  })

  test('content the convention has no place for is kept, not dropped', ({ assert }) => {
    const [[section]] = parsePages({
      title: 'T',
      body: [{ type: 'blockquote', content: [{ type: 'paragraph' }] }],
    } as never)
    assert.lengthOf(section.extra, 1)
  })
})

test.group('Resolving and checking pages', () => {
  test('auto pages and extra pages get a safe design, and the first page defaults to the cover', ({
    assert,
  }) => {
    assert.deepEqual(resolveDesigns(['cover', 'offer', 'contact'], 3), [
      'cover',
      'offer',
      'contact',
    ])
    assert.deepEqual(resolveDesigns(['auto', 'auto'], 3), ['cover', 'article', 'article'])
    assert.deepEqual(resolveDesigns(['cover'], 4), ['cover', 'article', 'article', 'article'])
    assert.deepEqual(resolveDesigns(['cover', 'offer', 'contact'], 2), ['cover', 'offer'])
  })

  test('the whole layout is open only until the model has chosen', ({ assert }) => {
    assert.isTrue(isOpenPlan({ source: 'ai', pages: ['auto'] }))
    assert.isFalse(isOpenPlan({ source: 'ai', pages: ['cover', 'offer'] }), 'chosen: now fixed')
    assert.isFalse(isOpenPlan({ source: 'custom', pages: ['auto'] }))
    assert.isFalse(isOpenPlan({ source: 'custom', pages: ['auto', 'auto'] }))
  })

  const parsed = (page: PageContent) => {
    const { document } = documentFromPages([samples.cover, page])
    const { client } = new PublicationProjectionService().project(document as never)
    return parsePages(client)[1]
  }

  test('text within a design’s limits gives no warning', ({ assert }) => {
    for (const id of DESIGN_IDS.filter((d) => d !== 'cover'))
      assert.deepEqual(lengthWarnings(id, parsed(samples[id]), 2), [], id)
  })

  test('text that has grown past what the design holds is reported in plain words', ({
    assert,
  }) => {
    const page = structuredClone(samples.offer)
    page.sections[1].groups[0].paragraphs[0].text = 'word '.repeat(120)
    const warnings = lengthWarnings('offer', parsed(page), 2)
    assert.lengthOf(warnings, 1)
    assert.match(warnings[0], /Page 2 \(Offer with a big number\)/)
    assert.match(warnings[0], /may be cut/)
  })

  test('cards a design cannot show are counted, not silently dropped', ({ assert }) => {
    const page = structuredClone(samples.columns)
    page.sections[1].groups.push({ heading: 'Fourth', paragraphs: [], bullets: [] })
    const warnings = lengthWarnings('columns', parsed(page), 3)
    assert.isTrue(warnings.some((w) => /3 cards at most; 1 will not appear/.test(w)))
  })
})

test.group('What the model is told', () => {
  test('every design is described with its own limits, taken from the table they are checked against', ({
    assert,
  }) => {
    for (const id of DESIGN_IDS) {
      const guide = designGuide(id)
      assert.include(guide, `- ${id} (${DESIGNS[id].label})`)
      assert.include(guide, 'Reads:')
      assert.include(guide, 'limits:')
    }
    assert.include(designGuide('offer'), 'title up to 50 characters')
    assert.include(designGuide('offer'), 'exactly three')
    assert.include(designGuide('glance'), 'up to 6 bullets of 34')
    assert.include(BROCHURE_PROTOCOL, 'Never invent')
    for (const id of DESIGN_IDS) assert.include(BROCHURE_PROTOCOL, id)
  })

  test('a fixed plan names every page; a free page is left to the model; an open plan asks it to choose', ({
    assert,
  }) => {
    const fixed = planText(
      { source: 'template', template: 'brief', pages: ['cover', 'article', 'contact'] },
      { min: 3, max: 3 }
    )
    assert.include(fixed, 'exactly 3 pages')
    assert.include(fixed, 'Page 2: article.')
    assert.notInclude(fixed, DESIGNS.offer.bestFor)
    const mixed = planText({ source: 'custom', pages: ['cover', 'auto'] }, { min: 2, max: 2 })
    assert.include(mixed, 'Page 1: cover.')
    assert.include(mixed, 'Page 2: you choose')
    for (const id of DESIGN_IDS) assert.include(mixed, DESIGNS[id].bestFor)
    const open = planText({ source: 'ai', pages: ['auto'] }, { min: 3, max: 9 })
    assert.include(open, '3 to 9 pages')
    for (const id of DESIGN_IDS) assert.include(open, DESIGNS[id].bestFor)
  })
})
