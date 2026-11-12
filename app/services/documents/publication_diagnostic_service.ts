import type {
  ClientBlock,
  ClientInline,
  ClientRenderData,
} from '../../../shared/publication/client.ts'

export const PUBLICATION_LINT_VERSION = 'out-03-lint-1'

export type Diagnostic = {
  code: string
  field: string
  range?: { from: number; to: number }
  severity: 'warning' | 'error'
  message: string
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

// Narrow, versioned rules. `error` means confirmed private data; `warning` is
// ordinary-looking prose that a person classifies. Matches are reported, never deleted.
const RULES: Array<{
  code: string
  severity: Diagnostic['severity']
  message: string
  re: RegExp
}> = [
  {
    code: 'private_route',
    severity: 'error',
    message: 'Contains a private route, storage path or local file path.',
    re: new RegExp(
      [
        '/workspaces/[0-9a-f-]{8,}/',
        '\\bworkspaces/[0-9a-f-]{8,}/(?:exports|files|documents)',
        '\\b(?:storage|drive)/(?:workspaces|private)\\b',
        'file://',
        '/(?:Users|home|private/tmp|var/folders)/[^\\s]+',
      ].join('|'),
      'i'
    ),
  },
  {
    code: 'evidence_identifier',
    severity: 'error',
    message: 'Contains a raw evidence or chunk identifier.',
    re: new RegExp(`(?:chunk|evidence|source)[\\w\\s:=#"'-]{0,20}${UUID}`, 'i'),
  },
  {
    code: 'reviewer_marker',
    severity: 'warning',
    message: 'Looks like a reviewer or to-do marker.',
    re: /\[\s*(?:reviewer|internal|todo|tbd|fixme)\b[^\]]*\]|\b(?:TODO|FIXME|TBD)\b|\breviewer\s*notes?\s*:/i,
  },
  {
    code: 'retrieval_trace',
    severity: 'warning',
    message: 'Looks like a retrieval or debug trace.',
    re: /\b(?:source[\s_-]?chunk[\s_-]?id|chunk[\s_-]?(?:id|index)|retrieval\s+score|debug\s*:)/i,
  },
]

/** Pure lint over a validated client DTO. Reports exact fields and ranges only. */
export default class PublicationDiagnosticService {
  lint(client: ClientRenderData): Diagnostic[] {
    const found: Diagnostic[] = []
    const scan = (value: string | undefined, field: string) => {
      if (!value) return
      for (const rule of RULES) {
        const match = rule.re.exec(value)
        if (match)
          found.push({
            code: rule.code,
            field,
            range: { from: match.index, to: match.index + match[0].length },
            severity: rule.severity,
            message: rule.message,
          })
      }
    }
    const inline = (nodes: ClientInline[] | undefined, field: string) =>
      nodes?.forEach((node, i) => {
        if (node.type !== 'text') return
        scan(node.text, `${field}[${i}].text`)
        node.marks?.forEach((mark, m) => {
          if (mark.type === 'link') scan(mark.href, `${field}[${i}].marks[${m}].href`)
        })
      })
    const block = (node: ClientBlock, field: string) => {
      switch (node.type) {
        case 'paragraph':
        case 'heading':
        case 'codeBlock':
          return inline(node.content, `${field}.content`)
        case 'image':
          scan(node.alt, `${field}.alt`)
          return scan(node.title, `${field}.title`)
        case 'blockquote':
          return node.content.forEach((child, i) => block(child, `${field}.content[${i}]`))
        case 'bulletList':
        case 'orderedList':
          return node.content.forEach((item, i) =>
            item.content.forEach((child, c) => block(child, `${field}.content[${i}].content[${c}]`))
          )
      }
    }
    scan(client.title, 'title')
    if (client.summary) block(client.summary, 'summary')
    client.body.forEach((node, i) => block(node, `body[${i}]`))
    client.results?.forEach((result, i) => {
      for (const key of ['value', 'units', 'scope', 'baseline', 'period', 'methodology'] as const)
        scan(result[key], `results[${i}].${key}`)
    })
    client.sources.forEach((source, i) => scan(source.label, `sources[${i}].label`))
    return found
  }
}
