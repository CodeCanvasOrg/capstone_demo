import { test } from '@japa/runner'
import {
  condenseCorrective,
  coverSystem,
  entrySystem,
  plannerSystem,
  problemCorrective,
} from '../../app/services/canvas/portfolio/portfolio_prompts.ts'

test.group('portfolio prompts', () => {
  test('the entry prompt states the slot lengths from the template and the footnote convention', ({
    assert,
  }) => {
    const prompt = entrySystem({ depth: 'detailed' })
    // Footnotes: chunk ids per row, never inline citations in the text.
    assert.include(prompt, 'The application turns them into numbered footnotes')
    assert.include(prompt, 'never write ids, numbers in brackets')
    // Gaps go to reviewer notes, not into the copy.
    assert.include(prompt, 'add a reviewer note')
    assert.include(prompt, 'Never write "not stated"')
    // Evidence kinds, and the red constraint.
    for (const kind of ['measured', 'estimated', 'client_reported', 'design_target'])
      assert.include(prompt, kind)
    assert.include(prompt, 'It prints first, in red')
    // Length per slot, from the eight-row budgets (2,2,3,1,2,2,1,2 lines).
    assert.include(prompt, 'Length per slot')
    assert.match(
      prompt,
      /rows\[2\]\.body \(constraint included\): about \d+ characters, at least \d+, never more than \d+/
    )
    assert.match(prompt, /- intro: about \d+ characters/)
    assert.include(prompt, 'exactly 8')
  })

  test('row counts follow the depth', ({ assert }) => {
    assert.include(entrySystem({ depth: 'concise' }), '4 to 5 short rows')
    assert.include(entrySystem({ depth: 'standard' }), '6 to 7 short rows')
  })

  test('the planner is told the entry count, the heading and category limits', ({ assert }) => {
    assert.include(plannerSystem({ depth: 'standard', entries: 'auto' }), '2 to 4')
    assert.include(plannerSystem({ depth: 'standard', entries: 3 }), 'exactly 3')
    assert.include(plannerSystem({ depth: 'standard', entries: 'auto' }), 'at most 40 characters')
  })

  test('the cover prompt asks for three composed lines and a short subtitle', ({ assert }) => {
    const prompt = coverSystem()
    assert.include(prompt, 'three composed lines')
    assert.match(prompt, /- subtitle: about \d+ characters/)
  })

  test('corrections name the field, its lines and its limit', ({ assert }) => {
    assert.include(
      condenseCorrective([{ field: 'rows[0].body', lines: 4, max: 2 }]),
      'rows[0].body takes 4 lines (limit 2)'
    )
    assert.include(problemCorrective([{ code: 'uncited', field: 'rows[1]' }]), 'rows[1] (uncited)')
  })
})
