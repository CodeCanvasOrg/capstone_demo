import { test } from '@japa/runner'
import { brochureQueries, outlineQueries } from '#services/documents/section_queries'
import type { OutlineDefinition } from '../../shared/templates/outlines.ts'

const outline = (text: string): OutlineDefinition => ({
  schemaVersion: 2,
  name: 'T',
  description: '',
  instructions: '',
  outline: text,
})

test.group('section queries', () => {
  test('an outline gets one query per section, led by the section and anchored by the brief', ({
    assert,
  }) => {
    const queries = outlineQueries(
      outline('# Title\n## Challenge\nWhat problem was solved\n## Results\nMeasured outcomes'),
      'Acme',
      'A long brief about logistics'
    )
    assert.deepEqual(
      queries.map((q) => q.label),
      ['Challenge', 'Results']
    )
    assert.match(queries[0].query, /^Challenge\nWhat problem was solved\nAcme\. A long brief/)
    assert.notEqual(queries[0].query, queries[1].query)
  })

  test('the brief anchor is short, so it cannot swamp the section', ({ assert }) => {
    const [query] = outlineQueries(outline('# T\n## A'), 'X', 'word '.repeat(500))
    assert.isBelow(query.query.length, 400)
  })

  test('an unreadable outline retrieves nothing rather than failing', ({ assert }) => {
    assert.deepEqual(outlineQueries(outline('no heading'), 'X', 'brief'), [])
  })

  test('fixed pages retrieve only for their own designs', ({ assert }) => {
    const queries = brochureQueries(
      { source: 'custom', pages: ['cover', 'recognition', 'contact'] },
      'Acme',
      'brief'
    )
    assert.deepEqual(
      queries.map((q) => q.key),
      ['cover', 'recognition', 'contact']
    )
  })

  test('where the model chooses, every design not fixed is a topic', ({ assert }) => {
    const queries = brochureQueries({ source: 'ai', pages: ['auto'] }, 'Acme', 'brief')
    assert.isAtLeast(queries.length, 9)
    const mixed = brochureQueries({ source: 'custom', pages: ['cover', 'auto'] }, 'Acme', 'brief')
    assert.equal(new Set(mixed.map((q) => q.key)).size, mixed.length)
    assert.include(
      mixed.map((q) => q.key),
      'cover'
    )
  })
})
