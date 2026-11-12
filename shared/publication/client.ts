/**
 * Client-safe publication contract (OUT-03). Layouts accept only this shape.
 * It is a closed union rebuilt field by field: unknown nodes, marks and
 * attributes are rejected, never passed through.
 */
export const CLIENT_SCHEMA_VERSION = 1

export type ClientMark =
  { type: 'bold' | 'italic' | 'strike' | 'underline' | 'code' } | { type: 'link'; href: string }

export type ClientInline =
  | { type: 'text'; text: string; marks?: ClientMark[] }
  | { type: 'hardBreak' }
  | { type: 'reference'; number: number }

export type ClientListItem = { type: 'listItem'; content: ClientBlock[] }

export type ClientBlock =
  | { type: 'paragraph'; content?: ClientInline[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content?: ClientInline[] }
  | { type: 'codeBlock'; content?: ClientInline[] }
  | { type: 'horizontalRule' }
  | { type: 'blockquote'; content: ClientBlock[] }
  | { type: 'bulletList'; content: ClientListItem[] }
  | { type: 'orderedList'; start?: number; content: ClientListItem[] }
  | {
      type: 'image'
      src: string
      alt?: string
      title?: string
      width?: string
      align?: 'left' | 'center' | 'right'
    }

export type ClientSource = { number: number; label: string; page?: number }

export const CLIENT_QUALIFIERS = [
  'measured',
  'estimated',
  'client_reported',
  'design_target',
] as const

/** A result keeps its qualifier and author-supplied context with the value, never apart. */
export type ClientResult = {
  value: string
  qualifier: (typeof CLIENT_QUALIFIERS)[number]
  comparison?: 'exact' | 'up_to' | 'at_least' | 'range'
  units?: string
  scope?: string
  baseline?: string
  period?: string
  methodology?: string
}

export type ClientRenderData = {
  schemaVersion: typeof CLIENT_SCHEMA_VERSION
  docType: 'case_study'
  title?: string
  summary?: Extract<ClientBlock, { type: 'paragraph' }>
  body: ClientBlock[]
  results?: ClientResult[]
  sources: ClientSource[]
}

export type ClientContentIssue = { field: string; code: string }

export class ClientContentError extends Error {
  constructor(readonly issues: ClientContentIssue[]) {
    // Field paths only: never echo the offending value.
    super(
      `Invalid client publication data: ${issues.map((i) => `${i.field} (${i.code})`).join(', ')}`
    )
  }
}

const MAX_DEPTH = 20
const MARKS = new Set(['bold', 'italic', 'strike', 'underline', 'code'])
const DATA_IMAGE = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/
const PRIVATE_ROUTE = /\/(?:workspaces|storage|drive)\//i

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Safe `https`, `http` and `mailto` targets only; no credentials or private routes. */
export function isSafeLink(href: string) {
  if (href.length > 2048 || !/^(https?:\/\/|mailto:)/i.test(href)) return false
  try {
    const url = new URL(href)
    if (url.username || url.password) return false
    return !PRIVATE_ROUTE.test(url.pathname)
  } catch {
    return false
  }
}

/**
 * Strictly validates and reconstructs client data from an unknown value.
 * The result is a fresh object that only contains allowlisted keys.
 */
export function parseClientRenderData(value: unknown): ClientRenderData {
  const issues: ClientContentIssue[] = []
  const fail = (field: string, code: string) => void issues.push({ field, code })
  const only = (node: Obj, field: string, allowed: string[]) => {
    for (const key of Object.keys(node))
      if (!allowed.includes(key)) fail(`${field}.${key}`, 'unknown_key')
  }
  const text = (raw: unknown, field: string) => {
    if (typeof raw === 'string') return raw
    fail(field, 'expected_string')
    return ''
  }
  const list = (raw: unknown, field: string): unknown[] => {
    if (Array.isArray(raw)) return raw
    fail(field, 'expected_array')
    return []
  }

  const mark = (raw: unknown, field: string): ClientMark | null => {
    if (!isObj(raw)) return (fail(field, 'expected_object'), null)
    const type = raw.type
    if (type === 'link') {
      only(raw, field, ['type', 'href'])
      const href = text(raw.href, `${field}.href`)
      if (!isSafeLink(href)) return (fail(`${field}.href`, 'unsafe_link'), null)
      return { type: 'link', href }
    }
    if (typeof type === 'string' && MARKS.has(type)) {
      only(raw, field, ['type'])
      return { type } as ClientMark
    }
    return (fail(`${field}.type`, 'unknown_mark'), null)
  }

  const inline = (raw: unknown, field: string): ClientInline | null => {
    if (!isObj(raw)) return (fail(field, 'expected_object'), null)
    if (raw.type === 'text') {
      only(raw, field, ['type', 'text', 'marks'])
      const out: ClientInline = { type: 'text', text: text(raw.text, `${field}.text`) }
      if (raw.marks !== undefined) {
        const marks = list(raw.marks, `${field}.marks`)
          .map((m, i) => mark(m, `${field}.marks[${i}]`))
          .filter((m): m is ClientMark => !!m)
        if (marks.length) out.marks = marks
      }
      return out
    }
    if (raw.type === 'hardBreak') return (only(raw, field, ['type']), { type: 'hardBreak' })
    if (raw.type === 'reference') {
      only(raw, field, ['type', 'number'])
      if (!Number.isInteger(raw.number) || (raw.number as number) < 1)
        return (fail(`${field}.number`, 'invalid_reference'), null)
      return { type: 'reference', number: raw.number as number }
    }
    return (fail(`${field}.type`, 'unknown_node'), null)
  }

  const inlines = (raw: unknown, field: string) =>
    raw === undefined
      ? undefined
      : list(raw, field)
          .map((n, i) => inline(n, `${field}[${i}]`))
          .filter((n): n is ClientInline => !!n)

  const item = (raw: unknown, field: string, depth: number): ClientListItem | null => {
    if (!isObj(raw) || raw.type !== 'listItem') return (fail(field, 'unknown_node'), null)
    only(raw, field, ['type', 'content'])
    return { type: 'listItem', content: blocks(raw.content, `${field}.content`, depth + 1) }
  }

  const block = (raw: unknown, field: string, depth: number): ClientBlock | null => {
    if (depth > MAX_DEPTH) return (fail(field, 'too_deep'), null)
    if (!isObj(raw)) return (fail(field, 'expected_object'), null)
    switch (raw.type) {
      case 'paragraph': {
        only(raw, field, ['type', 'content'])
        const content = inlines(raw.content, `${field}.content`)
        return content ? { type: 'paragraph', content } : { type: 'paragraph' }
      }
      case 'heading': {
        only(raw, field, ['type', 'level', 'content'])
        const level = raw.level
        if (!Number.isInteger(level) || (level as number) < 1 || (level as number) > 6)
          return (fail(`${field}.level`, 'invalid_level'), null)
        const content = inlines(raw.content, `${field}.content`)
        return { type: 'heading', level: level as 1, ...(content ? { content } : {}) }
      }
      case 'codeBlock': {
        only(raw, field, ['type', 'content'])
        const content = inlines(raw.content, `${field}.content`)
        return { type: 'codeBlock', ...(content ? { content } : {}) }
      }
      case 'horizontalRule':
        return (only(raw, field, ['type']), { type: 'horizontalRule' })
      case 'blockquote':
        only(raw, field, ['type', 'content'])
        return { type: 'blockquote', content: blocks(raw.content, `${field}.content`, depth + 1) }
      case 'bulletList':
      case 'orderedList': {
        only(raw, field, ['type', 'content', 'start'])
        const content = list(raw.content, `${field}.content`)
          .map((n, i) => item(n, `${field}.content[${i}]`, depth))
          .filter((n): n is ClientListItem => !!n)
        if (raw.type === 'bulletList') return { type: 'bulletList', content }
        const start = raw.start
        if (start !== undefined && (!Number.isInteger(start) || (start as number) < 0))
          fail(`${field}.start`, 'invalid_start')
        return {
          type: 'orderedList',
          ...(typeof start === 'number' && Number.isInteger(start) && start >= 0 ? { start } : {}),
          content,
        }
      }
      case 'image': {
        only(raw, field, ['type', 'src', 'alt', 'title', 'width', 'align'])
        const src = text(raw.src, `${field}.src`)
        if (!DATA_IMAGE.test(src)) fail(`${field}.src`, 'unsafe_image_source')
        const out: Extract<ClientBlock, { type: 'image' }> = { type: 'image', src }
        for (const key of ['alt', 'title'] as const)
          if (raw[key] !== undefined && raw[key] !== null)
            out[key] = text(raw[key], `${field}.${key}`)
        if (raw.width !== undefined && raw.width !== null) {
          const width = String(raw.width)
          if (/^\d{1,4}(?:%|px)?$/.test(width)) out.width = width
          else fail(`${field}.width`, 'invalid_width')
        }
        if (raw.align !== undefined && raw.align !== null) {
          if (raw.align === 'left' || raw.align === 'center' || raw.align === 'right')
            out.align = raw.align
          else fail(`${field}.align`, 'invalid_align')
        }
        return out
      }
      default:
        return (fail(`${field}.type`, 'unknown_node'), null)
    }
  }

  const blocks = (raw: unknown, field: string, depth: number) =>
    list(raw, field)
      .map((n, i) => block(n, `${field}[${i}]`, depth))
      .filter((n): n is ClientBlock => !!n)

  if (!isObj(value)) throw new ClientContentError([{ field: '$', code: 'expected_object' }])
  only(value, '$', ['schemaVersion', 'docType', 'title', 'summary', 'body', 'results', 'sources'])
  if (value.schemaVersion !== CLIENT_SCHEMA_VERSION) fail('schemaVersion', 'unsupported_version')
  if (value.docType !== 'case_study') fail('docType', 'unsupported_type')

  const out: ClientRenderData = {
    schemaVersion: CLIENT_SCHEMA_VERSION,
    docType: 'case_study',
    body: [],
    sources: [],
  }
  if (value.title !== undefined) out.title = text(value.title, 'title')
  if (value.summary !== undefined) {
    const summary = block(value.summary, 'summary', 0)
    if (summary?.type === 'paragraph') out.summary = summary
    else if (summary) fail('summary', 'expected_paragraph')
  }
  out.body = blocks(value.body, 'body', 0)
  if (value.results !== undefined) {
    const results = list(value.results, 'results').flatMap((raw, i) => {
      const field = `results[${i}]`
      if (!isObj(raw)) return (fail(field, 'expected_object'), [])
      only(raw, field, [
        'value',
        'qualifier',
        'comparison',
        'units',
        'scope',
        'baseline',
        'period',
        'methodology',
      ])
      const entry: ClientResult = {
        value: text(raw.value, `${field}.value`),
        qualifier: 'measured',
      }
      if ((CLIENT_QUALIFIERS as readonly string[]).includes(raw.qualifier as string))
        entry.qualifier = raw.qualifier as ClientResult['qualifier']
      else fail(`${field}.qualifier`, 'unknown_qualifier')
      if (raw.comparison !== undefined) {
        if (['exact', 'up_to', 'at_least', 'range'].includes(raw.comparison as string))
          entry.comparison = raw.comparison as ClientResult['comparison']
        else fail(`${field}.comparison`, 'invalid_comparison')
      }
      for (const key of ['units', 'scope', 'baseline', 'period', 'methodology'] as const)
        if (raw[key] !== undefined) entry[key] = text(raw[key], `${field}.${key}`)
      return [entry]
    })
    if (results.length) out.results = results
  }
  out.sources = list(value.sources, 'sources').flatMap((raw, i) => {
    const field = `sources[${i}]`
    if (!isObj(raw)) return (fail(field, 'expected_object'), [])
    only(raw, field, ['number', 'label', 'page'])
    if (!Number.isInteger(raw.number) || (raw.number as number) < 1)
      return (fail(`${field}.number`, 'invalid_reference'), [])
    const source: ClientSource = {
      number: raw.number as number,
      label: text(raw.label, `${field}.label`),
    }
    if (raw.page !== undefined) {
      if (Number.isInteger(raw.page) && (raw.page as number) > 0) source.page = raw.page as number
      else fail(`${field}.page`, 'invalid_page')
    }
    return [source]
  })

  if (issues.length) throw new ClientContentError(issues)
  return out
}
