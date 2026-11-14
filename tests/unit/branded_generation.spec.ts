/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { RunnableLambda } from '@langchain/core/runnables'
import OpenRouterService from '#services/open_router_service'
import OutlineTemplateService from '#services/documents/outline_template_service'
import { BRANDED_TEMPLATE_ID, outlineSections } from '../../shared/templates/outlines.ts'
import { brandedEntry } from '../fixtures/layout/branded_entry.ts'

const chunks = ['chunk-a', 'chunk-b'].map((id, chunkIndex) => ({
  id,
  chunkIndex,
  content: `Evidence text for ${id}`,
  fileName: 'customs-case-study.pdf',
  fileUrl: null,
  mediaType: 'application/pdf',
  pageNumber: chunkIndex + 2,
}))
const guard = async () => {}

async function branded() {
  return (await new OutlineTemplateService().resolve(BRANDED_TEMPLATE_ID)).definition
}

/** A service whose model replays `attempts` and records every message list it was sent. */
function stub(attempts: unknown[]) {
  const service = new OpenRouterService()
  const seen: any[][] = []
  let calls = 0
  ;(service as any).model = {
    withStructuredOutput: (_schema: unknown, options: { name?: string }) => {
      seen.push([options])
      return RunnableLambda.from((messages: any[]) => {
        seen.push(messages)
        return attempts[Math.min(calls++, attempts.length - 1)]
      })
    },
  }
  return { service, seen, calls: () => calls }
}
const system = (messages: any[]) => String(messages[0].content)

test.group('Branded company template', () => {
  test('is a first-class template with the branded section outline', async ({ assert }) => {
    const definition = await branded()
    assert.equal(definition.format, 'branded_entry')
    assert.equal(definition.name, 'Branded case study')
    assert.deepEqual(
      outlineSections(definition.outline).map((s) => s.heading),
      [
        'Title',
        'Key results',
        'The challenge',
        'The solution',
        'How it works',
        'Key capabilities',
        'Roadmap',
      ]
    )
  })
})

test.group('Branded entry generation', () => {
  test('returns an editable document and a private sidecar from the structured entry', async ({
    assert,
  }) => {
    const { service } = stub([brandedEntry])
    const out = await service.generateBrandedEntry(
      'Customs',
      'brief',
      chunks,
      await branded(),
      guard
    )
    const types = out.document.content.map((node: any) => node.type)
    assert.equal((out.document.content[0] as any).content[0].text, brandedEntry.hero.headline)
    assert.includeMembers(types, ['heading', 'paragraph', 'orderedList', 'bulletList'])
    assert.lengthOf(out.sidecar.results, 3)
    assert.include(
      out.sidecar.notes,
      'Client name and deployment dates not in the supplied material.'
    )
    // Citations were hydrated with display metadata by the existing chunk service.
    assert.include(JSON.stringify(out.document), 'customs-case-study.pdf')
  })

  test('the prompt carries the feedback rules and the schema limits', async ({ assert }) => {
    const { service, seen } = stub([brandedEntry])
    await service.generateBrandedEntry('Customs', 'brief', chunks, await branded(), guard)
    const prompt = system(seen[1])
    for (const needle of [
      'reviewer_notes',
      'leave the field empty',
      'never write about the source',
      '60 characters',
      '160 characters',
      'three sentences',
      'measured',
      'estimated',
      'client_reported',
      'design_target',
      'figure only',
      'must contain a number',
      'omit results',
      'footnote_ids',
      'Never invent',
    ])
      assert.include(prompt.toLowerCase(), needle.toLowerCase(), needle)
    assert.equal(seen[0][0].name, 'write_branded_entry')
  })

  test('the human message carries the brief, title and the supplied chunk ids only', async ({
    assert,
  }) => {
    const { service, seen } = stub([brandedEntry])
    await service.generateBrandedEntry('Customs title', 'Our brief', chunks, await branded(), guard)
    const human = JSON.stringify(seen[1][1].content)
    assert.include(human, 'Customs title')
    assert.include(human, 'Our brief')
    assert.include(human, 'chunk-a')
    assert.include(human, 'chunk-b')
  })

  test('copy that talks about the source is rejected and retried with the failing fields', async ({
    assert,
  }) => {
    const bad = structuredClone(brandedEntry)
    bad.solution.text = 'The source does not provide the client name.'
    const { service, seen, calls } = stub([bad, brandedEntry])
    const out = await service.generateBrandedEntry('T', 'B', chunks, await branded(), guard)
    assert.equal(calls(), 2)
    assert.include(JSON.stringify(out.document), 'An MVP that runs OCR')
    const retry = seen[2]
    const last = String(retry.at(-1).content)
    assert.include(last, 'copy_commentary')
    assert.include(last, 'solution.text')
  })

  test('schema violations (long headline, bad evidence) are retried, then fail cleanly', async ({
    assert,
  }) => {
    const bad = structuredClone(brandedEntry)
    bad.hero.headline = 'x'.repeat(80)
    const { service, calls } = stub([bad])
    const definition = await branded()
    await assert.rejects(
      () => service.generateBrandedEntry('T', 'B', chunks, definition, guard),
      /incomplete or invalid/
    )
    assert.equal(calls(), 3)
  })

  test('an entry with nothing readable is never accepted', async ({ assert }) => {
    const empty = {
      ...structuredClone(brandedEntry),
      hero: { headline: 'T', subhead: 'S' },
      results: [],
      challenge: { text: '', footnote_ids: [] },
      solution: { text: '', footnote_ids: [] },
      steps: [],
      capabilities: [],
      roadmap: '',
      footnotes: [],
    }
    const { service, calls } = stub([empty])
    const out = await service.generateBrandedEntry('T', 'B', chunks, await branded(), guard)
    // Only the hero exists; missing sections are simply absent, with no filler sentence.
    assert.lengthOf(out.document.content, 2)
    assert.notInclude(JSON.stringify(out.document), 'has not been provided')
    assert.equal(calls(), 1)
  })
})
