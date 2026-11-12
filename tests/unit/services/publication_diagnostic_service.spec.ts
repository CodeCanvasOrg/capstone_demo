import { test } from '@japa/runner'
import PublicationDiagnosticService from '#services/documents/publication_diagnostic_service'
import type { ClientRenderData } from '../../../shared/publication/client.ts'

const data = (text: string, extra: Partial<ClientRenderData> = {}): ClientRenderData => ({
  schemaVersion: 1,
  docType: 'case_study',
  body: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  sources: [],
  ...extra,
})
const lint = (text: string, extra?: Partial<ClientRenderData>) =>
  new PublicationDiagnosticService().lint(data(text, extra))

test.group('PublicationDiagnosticService', () => {
  test('reports exact field, range and code without altering the input', ({ assert }) => {
    const input = data('Intro. [Reviewer: check this] Outro.')
    const before = JSON.stringify(input)
    const [finding] = new PublicationDiagnosticService().lint(input)
    assert.equal(finding.code, 'reviewer_marker')
    assert.equal(finding.field, 'body[0].content[0].text')
    assert.deepEqual(finding.range, { from: 7, to: 29 })
    assert.equal(finding.severity, 'warning')
    assert.equal(JSON.stringify(input), before)
  })

  test('private routes and evidence ids are errors across case, whitespace and line breaks', ({
    assert,
  }) => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e'
    for (const text of [
      'See /workspaces/0f8fad5b-d9cb/documents/x',
      'see FILE:///etc/passwd',
      `Evidence\nchunk:   ${id}`,
      `SOURCE ID ${id}`,
      'at /Users/jane/Documents/notes.pdf',
    ])
      assert.isTrue(
        lint(text).some((d) => d.severity === 'error'),
        text
      )
  })

  test('ordinary prose, quoted gap language and plain UUIDs are not flagged', ({ assert }) => {
    for (const text of [
      'Our review process set a target of 40% faster delivery (estimated).',
      'Results have not been independently measured.',
      'Order 0f8fad5b-d9cb-469f-a165-70867728950e shipped.',
      'The TODOs were closed.',
    ])
      assert.deepEqual(lint(text), [], text)
  })

  test('checks title, source labels and link targets', ({ assert }) => {
    const found = new PublicationDiagnosticService().lint(
      data('x', {
        title: 'TODO title',
        sources: [{ number: 1, label: 'debug: trace' }],
        body: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'x',
                marks: [{ type: 'link', href: 'https://a.test/storage/workspaces/abc' }],
              },
            ],
          },
        ],
      })
    )
    assert.sameMembers(
      found.map((d) => d.field),
      ['title', 'sources[0].label', 'body[0].content[0].marks[0].href']
    )
  })
})
