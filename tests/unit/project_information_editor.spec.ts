import { test } from '@japa/runner'
import { getSchema } from '@tiptap/core'
import { EditorState, TextSelection, AllSelection } from '@tiptap/pm/state'
import { joinBackward, splitBlock } from '@tiptap/pm/commands'
import { generateHTML } from '@tiptap/html/server'
import {
  informationFields,
  informationToContent,
  projectInformationExtensions,
} from '../../shared/project_information.ts'
const schema = getSchema(projectInformationExtensions())
test.group('Project information editor', () => {
  test('legacy prose and all seven rendered headings survive', ({ assert }) => {
    const doc = schema.nodeFromJSON(
      informationToContent({ overview: 'First line\n\nLast line 🐝' })
    )
    doc.check()
    assert.equal(doc.firstChild!.childCount, 3)
    assert.equal(doc.firstChild!.lastChild!.textContent, 'Last line 🐝')
    assert.equal(schema.topNodeType.createAndFill()!.childCount, 7)
    const html = generateHTML(doc.toJSON(), projectInformationExtensions())
    for (const [, label] of informationFields) assert.include(html, `>${label}</h2>`)
    assert.include(html, 'contenteditable="false"')
    assert.notInclude(html, '<textarea')
  })
  test('typing, paragraph splits and select-all deletion preserve the schema', ({ assert }) => {
    let state = EditorState.create({ schema, doc: schema.nodeFromJSON(informationToContent({})) })
    state = state.apply(state.tr.insertText('A project brief'))
    assert.equal(state.doc.firstChild!.textContent, 'A project brief')
    splitBlock(state, (tr) => {
      state = state.apply(tr)
    })
    assert.equal(state.doc.firstChild!.childCount, 2)
    state = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, state.doc.firstChild!.nodeSize + 2))
    )
    assert.isFalse(joinBackward(state))
    state = state.apply(state.tr.setSelection(new AllSelection(state.doc)).deleteSelection())
    state.doc.check()
    assert.equal(state.doc.childCount, 7)
    assert.equal(state.doc.textContent, '')
  })
  test('missing, duplicate and reordered sections fail schema validation', ({ assert }) => {
    const content = informationToContent({}).content!
    for (const invalid of [
      content.slice(1),
      [content[0], ...content.slice(0, 6)],
      [...content].reverse(),
    ])
      assert.throws(() => schema.nodeFromJSON({ type: 'doc', content: invalid }).check())
  })
})
