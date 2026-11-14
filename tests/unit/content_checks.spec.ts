import { test } from '@japa/runner'
import {
  MAX_REPAIR_ATTEMPTS,
  checkContent,
  checkQualifierPreservation,
  repairContent,
} from '../../shared/layout/checks.ts'
import { getBrandKit } from '../../shared/layout/brand.ts'
import type { ClientRenderData } from '../../shared/publication/client.ts'
import * as fx from '../fixtures/layout/entries.ts'

const brand = getBrandKit('humblebee')!
const codes = (data: ClientRenderData) => checkContent(data, { brand }).map((f) => f.code)

test.group('Content checks (OUT-05)', () => {
  test('clean entry 01 produces no findings', ({ assert }) => {
    assert.deepEqual(codes(fx.entry01), [])
  })

  test('schema failures are reported with field paths, never values', ({ assert }) => {
    const found = checkContent({ ...fx.entry01, docType: 'poem' } as never, { brand })
    assert.equal(found[0].code, 'schema_invalid')
    assert.include(found[0].field, 'docType')
    assert.notInclude(JSON.stringify(found), 'poem')
  })

  test('malformed citations: references without a source and sources never cited', ({ assert }) => {
    const bad = { ...fx.entry01, sources: fx.entry01.sources.slice(0, 1) }
    assert.include(codes(bad), 'citation_missing_source')
    const uncited = { ...fx.entry01, sources: [...fx.entry01.sources, { number: 9, label: 'X' }] }
    assert.include(codes(uncited), 'citation_uncited_source')
  })

  test('title repeated as the first heading or as the summary is flagged', ({ assert }) => {
    const heading = { ...fx.entry01, body: [fx.h2(fx.entry01.title!), ...fx.entry01.body] }
    assert.include(codes(heading), 'title_repeated')
    const summary = {
      ...fx.entry01,
      summary: { type: 'paragraph' as const, content: fx.t(fx.entry01.title!) },
    }
    assert.include(codes(summary), 'title_repeated')
  })

  test('brand variants are reported with ranges; proper nouns are not globally rewritten', ({
    assert,
  }) => {
    const found = checkContent(fx.misspelled, { brand }).filter((f) => f.code === 'brand_spelling')
    assert.lengthOf(found, 2)
    assert.equal(found[0].severity, 'warning')
    assert.isDefined(found[0].range)
  })

  test('pipeline commentary is a targeted lint, not a ban on the word "source"', ({ assert }) => {
    const commentary = {
      ...fx.entry01,
      body: [fx.p('The source does not specify the deployment date.')],
    }
    assert.include(codes(commentary), 'pipeline_commentary')
    const fine = {
      ...fx.entry01,
      body: [fx.p('The open source toolkit and the data source were both reused.', 1)],
    }
    assert.notInclude(codes(fine), 'pipeline_commentary')
  })

  test('84 sentences starting "The source…" are all reported, none deleted', ({ assert }) => {
    const data: ClientRenderData = {
      ...fx.entry01,
      body: Array.from({ length: 84 }, () => fx.p('The source states a result.', 1)),
    }
    const found = checkContent(data, { brand }).filter((f) => f.code === 'pipeline_commentary')
    assert.lengthOf(found, 84)
    assert.lengthOf(data.body, 84)
  })

  test('numbers in prose with no citation and no result are unsupported-number warnings', ({
    assert,
  }) => {
    const data = { ...fx.entry01, body: [fx.p('Revenue grew 73% last year.')] }
    const found = checkContent(data, { brand }).filter((f) => f.code === 'unsupported_number')
    assert.lengthOf(found, 1)
    // A cited number, or one that matches a declared result, is not flagged.
    assert.notInclude(
      codes({ ...fx.entry01, body: [fx.p('Revenue grew 73% last year.', 1)] }),
      'unsupported_number'
    )
    assert.notInclude(
      codes({ ...fx.entry01, body: [fx.p('Clearance fell by 42%.')] }),
      'unsupported_number'
    )
  })

  test('findings never claim a citation proves support', ({ assert }) => {
    for (const f of checkContent(fx.misspelled, { brand }))
      assert.notMatch(f.message, /verified|proven/i)
  })
})

test.group('Qualifier preservation (OUT-05)', () => {
  test('dropping or changing "up to", the estimate label, units or baseline is a finding', ({
    assert,
  }) => {
    const before = [fx.upTo, fx.measured]
    assert.isEmpty(checkQualifierPreservation(before, [fx.upTo, fx.measured]))
    const dropped = checkQualifierPreservation(before, [
      { ...fx.upTo, comparison: 'exact' },
      fx.measured,
    ])
    assert.equal(dropped[0].code, 'qualifier_changed')
    const relabeled = checkQualifierPreservation(before, [
      { ...fx.upTo, qualifier: 'measured' },
      fx.measured,
    ])
    assert.equal(relabeled[0].code, 'qualifier_changed')
    const noUnits = checkQualifierPreservation(before, [
      fx.upTo,
      { ...fx.measured, baseline: undefined },
    ])
    assert.equal(noUnits[0].code, 'context_dropped')
    const lost = checkQualifierPreservation(before, [fx.measured])
    assert.equal(lost[0].code, 'result_removed')
  })
})

test.group('Bounded repair (OUT-05)', () => {
  const bad: ClientRenderData = { ...fx.entry01, summary: fx.misspelled.summary }
  const fixSpelling = (data: ClientRenderData): ClientRenderData => ({
    ...data,
    summary: fx.entry01.summary,
  })

  test('a targeted repair that resolves the findings is accepted and the original is kept', async ({
    assert,
  }) => {
    const calls: string[][] = []
    const out = await repairContent(bad, {
      brand,
      generate: async (data, failing) => {
        calls.push(failing.map((f) => f.field))
        return fixSpelling(data)
      },
    })
    assert.isTrue(out.resolved)
    assert.lengthOf(calls, 1)
    assert.deepEqual(out.original, bad)
    assert.deepEqual(out.final, fixSpelling(bad))
    assert.lengthOf(out.history, 1)
    assert.include(calls[0][0], 'summary')
  })

  test('at most two automatic attempts, then unresolved issues go to the reviewer', async ({
    assert,
  }) => {
    let count = 0
    const out = await repairContent(bad, {
      brand,
      generate: async (data) => {
        count++
        return data
      },
    })
    assert.equal(MAX_REPAIR_ATTEMPTS, 2)
    assert.equal(count, 2)
    assert.isFalse(out.resolved)
    assert.isNotEmpty(out.unresolved)
  })

  test('a repair that drops a qualifier is rejected and revalidated', async ({ assert }) => {
    const out = await repairContent(bad, {
      brand,
      generate: async (data) => ({
        ...fixSpelling(data),
        results: [{ ...fx.upTo, comparison: 'exact' as const }, fx.measured],
      }),
    })
    assert.isFalse(out.resolved)
    assert.deepEqual(out.final, bad)
    assert.include(
      out.unresolved.map((f) => f.code),
      'qualifier_changed'
    )
  })

  test('nothing to repair makes no model call', async ({ assert }) => {
    let called = false
    const out = await repairContent(fx.entry01, {
      brand,
      generate: async (data) => {
        called = true
        return data
      },
    })
    assert.isTrue(out.resolved)
    assert.isFalse(called)
  })

  test('a provider failure surfaces an actionable error without changing content', async ({
    assert,
  }) => {
    const out = await repairContent(bad, {
      brand,
      generate: async () => {
        throw new Error('boom')
      },
    })
    assert.isFalse(out.resolved)
    assert.deepEqual(out.final, bad)
    assert.equal(out.error?.code, 'repair_failed')
  })
})
