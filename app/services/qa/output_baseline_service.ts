import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import vine from '@vinejs/vine'
import {
  attachChunkMetadata,
  type TipTapDocument,
} from '#services/documents/chunk_metadata_service'
import type { SourceChunk } from '#services/documents/chunk_metadata_service'
import { PUBLICATION_PROJECTION_VERSION } from '#services/documents/publication_projection_service'

const run = promisify(execFile)

export const CORPUS_VERSION = 'qa01-v1'
export const REQUIRED_CASES = [
  'qa01-entry-01',
  'qa01-no-image',
  'qa01-no-metric',
  'qa01-long-title',
  'qa01-estimated-result',
  'qa01-long-citations',
]

export type Layout = 'legacy' | 'pilot'
export type Availability<T> =
  | { status: 'measured' | 'recorded'; value: T; method: string }
  | { status: 'unavailable'; value: null; reason: string }

type Node = TipTapDocument['content'][number]
type Source = {
  fixtureSourceId: string
  revision: number
  chunkId: string
  sha256: string
  hashBasis: 'original_bytes' | 'frozen_excerpt'
  fileName: string
  pageNumber: number
  chunkIndex: number
  mediaType: string
  content: string
  asset?: string
}
type Expectations = {
  description: string
  requiredText: string[]
  forbiddenPatterns: string[]
  imageCount: number
  referenceCount: number
  titleLength?: number
}
type ManifestCase = {
  fixtureId: string
  revision: number
  variant: 'internal' | 'sanitized'
  origin: 'captured' | 'synthetic'
  contentHash: string
  expectationsHash: string
  sourceManifestHash: string
  assets: { path: string; sha256: string; mime: string }[]
}
export type Corpus = {
  dir: string
  corpusVersion: string
  cases: (ManifestCase & {
    content: TipTapDocument
    sources: Source[]
    expectations: Expectations
  })[]
  assets: Map<string, Buffer>
  claims: ClaimRow[]
}
export type ClaimRow = Record<string, string>

const manifestSchema = vine.compile(
  vine.object({
    schemaVersion: vine.literal(1),
    corpusVersion: vine.string(),
    variant: vine.enum(['internal', 'sanitized']),
    cases: vine.array(
      vine.object({
        fixtureId: vine.string(),
        revision: vine.number().min(1),
        variant: vine.enum(['internal', 'sanitized']),
        origin: vine.enum(['captured', 'synthetic']),
        contentHash: vine.string().fixedLength(64),
        expectationsHash: vine.string().fixedLength(64),
        sourceManifestHash: vine.string().fixedLength(64),
        assets: vine.array(
          vine.object({
            path: vine.string(),
            sha256: vine.string().fixedLength(64),
            mime: vine.string(),
          })
        ),
      })
    ),
  })
)

export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

/** Sorted object keys, preserved array order, so identity ignores key ordering only. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as any)[key])}`)
      .join(',')}}`
  return JSON.stringify(value)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const AUTHORSHIP = ['ai', 'user', 'unknown']
const GOLD = ['supported', 'contradicted', 'unsupported', '']
const STATES = ['pending', 'reviewed', 'disputed', 'exempt_user', 'needs_authorship']

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((cell) => cell !== '')) rows.push(row)
      row = []
    } else field += char
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...body] = rows
  return body.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ''])))
}

/** Spreadsheet-safe display form; the stored claim text and hash are never altered. */
export const csvDisplay = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)

const textOf = (node: Node): string => node.text ?? (node.content ?? []).map(textOf).join('')
const walk = (node: Node, visit: (node: Node) => void) => {
  visit(node)
  node.content?.forEach((child) => walk(child, visit))
}
const nodes = (content: TipTapDocument) => {
  const all: Node[] = []
  content.content.forEach((node) => walk(node, (n) => all.push(n)))
  return all
}
const bodyText = (content: TipTapDocument) => content.content.map(textOf).join('\n')

/** Resolves an asset only inside the manifest directory; rejects remote and traversal paths. */
export function resolveAsset(dir: string, assetPath: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(assetPath) || assetPath.startsWith('//'))
    throw new Error(`Remote asset rejected: ${assetPath}`)
  const full = path.resolve(dir, assetPath)
  if (full !== dir && !full.startsWith(dir + path.sep))
    throw new Error(`Asset escapes corpus directory: ${assetPath}`)
  return full
}

export default class OutputBaselineService {
  async load(manifestPath: string): Promise<Corpus> {
    const dir = path.dirname(path.resolve(manifestPath))
    const manifest = await manifestSchema.validate(JSON.parse(await readFile(manifestPath, 'utf8')))
    const assets = new Map<string, Buffer>()
    const cases: Corpus['cases'] = []
    for (const entry of manifest.cases) {
      const base = path.join('cases', entry.fixtureId)
      const read = async (name: string) =>
        JSON.parse(await readFile(resolveAsset(dir, path.join(base, name)), 'utf8'))
      for (const asset of entry.assets)
        if (!assets.has(asset.path))
          assets.set(asset.path, await readFile(resolveAsset(dir, asset.path)))
      const sourcesFile = await read('sources.json')
      cases.push({
        ...entry,
        content: await read('content.json'),
        sources: sourcesFile.sources,
        expectations: await read('expectations.json'),
      })
    }
    let claims: ClaimRow[] = []
    try {
      claims = parseCsv(await readFile(path.join(dir, 'claim-review.csv'), 'utf8'))
    } catch {}
    return { dir, corpusVersion: manifest.corpusVersion, cases, assets, claims }
  }

  /** Returns every integrity problem found; an empty list means the corpus is valid. */
  validate(corpus: Corpus): string[] {
    const problems: string[] = []
    const ids = corpus.cases.map((c) => c.fixtureId)
    for (const id of REQUIRED_CASES) if (!ids.includes(id)) problems.push(`Missing case ${id}`)
    for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i)))
      problems.push(`Duplicate case ${id}`)
    if (corpus.corpusVersion !== CORPUS_VERSION)
      problems.push(`Unexpected corpus version ${corpus.corpusVersion}`)

    for (const c of corpus.cases) {
      const at = (message: string) => problems.push(`${c.fixtureId}: ${message}`)
      if (sha256(canonicalJson(c.content)) !== c.contentHash) at('content hash drift')
      if (sha256(canonicalJson({ schemaVersion: 1, ...c.expectations })) !== c.expectationsHash)
        at('expectations hash drift')
      const identity = c.sources.map((s) => ({
        fixtureSourceId: s.fixtureSourceId,
        revision: s.revision,
        sha256: s.sha256,
        hashBasis: s.hashBasis,
        chunkId: s.chunkId,
        pageNumber: s.pageNumber,
      }))
      if (sha256(canonicalJson(identity)) !== c.sourceManifestHash) at('source manifest hash drift')

      const chunkIds = new Set<string>()
      for (const s of c.sources) {
        if (!UUID.test(s.chunkId)) at(`invalid chunk UUID ${s.chunkId}`)
        if (chunkIds.has(s.chunkId)) at(`duplicate chunk ${s.chunkId}`)
        chunkIds.add(s.chunkId)
        if (s.asset) {
          const bytes = corpus.assets.get(s.asset)
          if (!bytes) at(`source ${s.fixtureSourceId} references unknown asset ${s.asset}`)
          else if (sha256(bytes) !== s.sha256) at(`asset hash drift for ${s.asset}`)
          if (!c.assets.some((a) => a.path === s.asset)) at(`asset ${s.asset} not declared`)
        } else if (sha256(Buffer.from(s.content, 'utf8')) !== s.sha256)
          at(`source hash drift for ${s.fixtureSourceId}`)
      }
      for (const a of c.assets) {
        try {
          resolveAsset(corpus.dir, a.path)
        } catch (error) {
          at((error as Error).message)
        }
        const bytes = corpus.assets.get(a.path)
        if (!bytes || sha256(bytes) !== a.sha256) at(`declared asset ${a.path} hash mismatch`)
      }

      const all = nodes(c.content)
      for (const n of all) {
        const ref = n.attrs?.sourceChunkId
        if ((n.type === 'sourceCitation' || n.type === 'image') && !chunkIds.has(String(ref)))
          at(`dangling ${n.type} reference ${String(ref)}`)
      }
      const images = all.filter((n) => n.type === 'image').length
      if (images !== c.expectations.imageCount)
        at(`expected ${c.expectations.imageCount} images, body has ${images}`)
      const text = bodyText(c.content)
      for (const pattern of c.expectations.forbiddenPatterns)
        if (new RegExp(pattern).test(text)) at(`body matches forbidden pattern ${pattern}`)
      for (const needle of c.expectations.requiredText)
        if (!text.includes(needle)) at(`body lacks required text "${needle.slice(0, 40)}"`)
      const refs = new Set(
        all.filter((n) => n.type === 'sourceCitation').map((n) => String(n.attrs?.sourceChunkId))
      )
      if (refs.size !== c.expectations.referenceCount)
        at(`expected ${c.expectations.referenceCount} distinct references, body has ${refs.size}`)
      if (c.expectations.titleLength) {
        const title = textOf(c.content.content[0])
        if ([...title].length !== c.expectations.titleLength)
          at(`title length ${[...title].length}, expected ${c.expectations.titleLength}`)
      }
      if (c.variant === 'sanitized') {
        const dump = JSON.stringify([c.content, c.sources])
        if (/\/workspaces\/|https?:\/\/|fileUrl|chunkText/i.test(dump))
          at('sanitized fixture contains URL or private-metadata keys')
      }
    }

    for (const row of corpus.claims) {
      const at = (message: string) =>
        problems.push(`claim ${row.fixture_id}/${row.claim_id}: ${message}`)
      const c = corpus.cases.find((x) => x.fixtureId === row.fixture_id)
      if (!c) return [...problems, `claim ${row.claim_id}: unknown fixture ${row.fixture_id}`]
      if (row.corpus_version !== corpus.corpusVersion) at('wrong corpus version')
      if (row.fixture_revision !== String(c.revision)) at('stale fixture revision')
      if (sha256(row.text) !== row.text_hash) at('text hash drift')
      if (!AUTHORSHIP.includes(row.authorship)) at(`bad authorship ${row.authorship}`)
      if (!GOLD.includes(row.gold_label)) at(`bad gold label ${row.gold_label}`)
      if (!STATES.includes(row.review_state)) at(`bad review state ${row.review_state}`)
      if (row.authorship !== 'ai' && row.gold_label) at('only AI claims carry a gold label')
      if (row.gold_label && !row.rationale) at('gold label without rationale')
      if (row.source_ids) {
        const picked = row.source_ids
          .split(';')
          .map((id) => c.sources.find((s) => s.fixtureSourceId === id))
        if (picked.some((s) => !s)) at('dangling source id')
        else if (sha256(picked.map((s) => s!.content).join('\n')) !== row.evidence_hash)
          at('evidence hash drift')
      }
      if (row.content_path) {
        const target = row.content_path
          .split('/')
          .filter(Boolean)
          .reduce<any>((node, key) => node?.[key], c.content)
        if (!target || !textOf(target).includes(row.text))
          at('content_path does not contain claim text')
      }
    }
    return problems
  }

  /**
   * Counts reviewed AI claims only. Pending/disputed labels are not gold; user and unknown
   * authorship are reported separately and never enter the AI denominator.
   */
  summarizeClaims(rows: ClaimRow[]) {
    const ai = rows.filter((r) => r.authorship === 'ai')
    const reviewed = ai.filter((r) => r.review_state === 'reviewed' && r.gold_label)
    const count = (label: string) => reviewed.filter((r) => r.gold_label === label).length
    const [s, c, u] = [count('supported'), count('contradicted'), count('unsupported')]
    return {
      reviewedAi: reviewed.length,
      eligibleAi: ai.length,
      unreviewedAi: ai.length - reviewed.length,
      supported: s,
      contradicted: c,
      unsupported: u,
      user: rows.filter((r) => r.authorship === 'user').length,
      unknownAuthorship: rows.filter((r) => r.authorship === 'unknown').length,
      unsupportedOrContradictedRate:
        s + c + u > 0
          ? {
              status: 'measured' as const,
              value: (c + u) / (s + c + u),
              method: '(C+U)/(S+C+U) over reviewed AI claims',
            }
          : {
              status: 'unavailable' as const,
              value: null,
              reason: 'No reviewed AI claims (denominator zero)',
            },
    }
  }

  /** Builds the hydrated document the renderer sees; images become embedded data URIs. */
  hydrate(corpus: Corpus, fixtureId: string): TipTapDocument {
    const c = corpus.cases.find((x) => x.fixtureId === fixtureId)!
    const chunks: SourceChunk[] = c.sources.map((s) => ({
      id: s.chunkId,
      chunkIndex: s.chunkIndex,
      content: s.content,
      fileName: s.fileName,
      fileUrl: null,
      mediaType: s.mediaType,
      pageNumber: s.pageNumber,
    }))
    const images = new Map<string, { id: string; src: string; filename: string; mime: string }>()
    const content = JSON.parse(JSON.stringify(c.content)) as TipTapDocument
    for (const node of nodes(content)) {
      if (node.type !== 'image') continue
      const source = c.sources.find((s) => s.chunkId === node.attrs?.sourceChunkId)
      const bytes = source?.asset ? corpus.assets.get(source.asset) : undefined
      if (!source || !bytes) throw new Error(`${fixtureId}: image has no local asset`)
      images.set(source.chunkId, {
        id: source.chunkId,
        src: `data:${source.mediaType};base64,${bytes.toString('base64')}`,
        filename: source.fileName,
        mime: source.mediaType,
      })
      node.attrs = { ...node.attrs, documentImageId: source.chunkId }
      delete node.attrs.sourceChunkId
    }
    return attachChunkMetadata(content, chunks, images)
  }

  async render(corpus: Corpus, options: RenderOptions): Promise<Report> {
    const { clock, renderer, inspector, outputDir } = options
    await mkdir(path.dirname(outputDir), { recursive: true })
    try {
      await mkdir(outputDir) // refuses to overwrite an earlier run
    } catch {
      throw new Error(`Output directory already exists: ${outputDir}`)
    }
    const problems = this.validate(corpus)
    const environment = await options.environment()
    const results: CaseResult[] = []

    for (const c of corpus.cases) {
      const content = this.hydrate(corpus, c.fixtureId)
      for (const layout of options.layouts) {
        const publication = layout === 'pilot'
        const prefix = `${c.fixtureId}.${layout}`
        const result: CaseResult = {
          fixtureId: c.fixtureId,
          revision: c.revision,
          layout,
          projectionVersion: publication ? PUBLICATION_PROJECTION_VERSION : null,
          html: { status: 'unavailable', value: null, reason: 'not rendered' },
          pdf: { status: 'unavailable', value: null, reason: 'not rendered' },
          checks: [],
        }
        results.push(result)

        let htmlText = ''
        try {
          const started = clock()
          const html = await renderer.html(content, { publication, preview: true })
          const ms = clock() - started
          htmlText = html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
          await writeFile(path.join(outputDir, `${prefix}.html`), html)
          result.html = {
            status: 'measured',
            method: 'ExportPdfService.html',
            value: { bytes: Buffer.byteLength(html), sha256: sha256(html), ms },
          }
          result.checks.push(...this.checkHtml(c, html, htmlText, publication))
        } catch (error) {
          result.html = { status: 'unavailable', value: null, reason: (error as Error).message }
        }

        try {
          const started = clock()
          const pdf = await renderer.pdf(content, { publication, preview: true })
          const renderMs = clock() - started
          await writeFile(path.join(outputDir, `${prefix}.pdf`), pdf)
          const inspectStarted = clock()
          const inspection = await inspector(path.join(outputDir, `${prefix}.pdf`))
          result.pdf = {
            status: 'measured',
            method: 'ExportPdfService.generate + PyMuPDF',
            value: {
              bytes: pdf.length,
              sha256: sha256(pdf),
              pages: inspection.pages,
              imagesPerPage: inspection.imagesPerPage,
              renderMs,
              inspectMs: clock() - inspectStarted,
              previewWarning: /NOT APPROVED/.test(inspection.text.join('\n')),
            },
          }
          result.checks.push(...this.checkPdfText(c, inspection.text.join('\n')))
        } catch (error) {
          // Never report a page count of zero for a failed render.
          result.pdf = { status: 'unavailable', value: null, reason: (error as Error).message }
        }
      }
    }

    const report: Report = {
      schemaVersion: 1,
      runId: path.basename(outputDir),
      createdAt: options.now().toISOString(),
      corpusVersion: corpus.corpusVersion,
      cases: corpus.cases.map((c) => ({
        fixtureId: c.fixtureId,
        revision: c.revision,
        variant: c.variant,
        contentHash: c.contentHash,
        sourceManifestHash: c.sourceManifestHash,
        assetHashes: c.assets.map((a) => a.sha256),
      })),
      environment,
      generation: {
        calls: 0,
        note: 'Deterministic replay of frozen content; no provider call, so model, settings and usage are not applicable.',
      },
      claims: this.summarizeClaims(corpus.claims),
      validationProblems: problems,
      results,
      ok:
        problems.length === 0 &&
        results.every(
          (r) =>
            r.html.status === 'measured' &&
            r.pdf.status === 'measured' &&
            r.checks.every((x) => x.ok)
        ),
    }
    await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', {
      flag: 'wx',
    })
    return report
  }

  private checkHtml(c: Corpus['cases'][number], html: string, text: string, publication: boolean) {
    const checks: Check[] = []
    const flat = text.replace(/\s+/g, ' ')
    for (const needle of c.expectations.requiredText)
      checks.push({ name: `html text: ${needle.slice(0, 48)}`, ok: flat.includes(needle) })
    for (const pattern of c.expectations.forbiddenPatterns)
      checks.push({
        name: `html forbids ${pattern}`,
        ok: !new RegExp(pattern).test(pattern === '<img' ? html : flat),
      })
    checks.push({
      name: 'html image count',
      ok: (html.match(/<img\b/g) ?? []).length === c.expectations.imageCount,
    })
    if (publication) {
      const leaks = c.sources.filter((s) => html.includes(s.chunkId) || html.includes(s.content))
      checks.push({ name: 'pilot payload has no chunk IDs or excerpts', ok: leaks.length === 0 })
      const numbers = new Set([...html.matchAll(/<sup class="ref">(\d+)<\/sup>/g)].map((m) => m[1]))
      checks.push({
        name: 'pilot reference coverage',
        ok: numbers.size === c.expectations.referenceCount,
        detail: `${numbers.size}/${c.expectations.referenceCount}`,
      })
      const listed = (html.match(/<li value="\d+">/g) ?? []).length
      checks.push({
        name: 'pilot sources listed',
        ok: listed === c.expectations.referenceCount,
        detail: String(listed),
      })
    }
    return checks
  }

  private checkPdfText(c: Corpus['cases'][number], pdfText: string) {
    const flat = pdfText.replace(/\s+/g, '')
    return c.expectations.requiredText.map((needle) => ({
      name: `pdf text: ${needle.slice(0, 48)}`,
      ok: flat.includes(needle.replace(/\s+/g, '')),
    }))
  }

  /** Compares a run with a reviewed baseline; environment mismatch is "not comparable". */
  compare(report: Report, baseline: Report, tolerances = { bytesPct: 10 }): Comparison {
    const keys = ['os', 'arch', 'node', 'chromium', 'lockfileSha256', 'fontSha256'] as const
    const mismatched = keys.filter(
      (key) => JSON.stringify(report.environment[key]) !== JSON.stringify(baseline.environment[key])
    )
    if (mismatched.length)
      return {
        status: 'not_comparable',
        differences: [`Environment differs: ${mismatched.join(', ')}`],
      }

    const differences: string[] = []
    if (report.corpusVersion !== baseline.corpusVersion) differences.push('corpus version differs')
    for (const base of baseline.cases) {
      const now = report.cases.find((c) => c.fixtureId === base.fixtureId)
      if (!now) differences.push(`${base.fixtureId}: missing from run`)
      else if (
        now.contentHash !== base.contentHash ||
        now.sourceManifestHash !== base.sourceManifestHash
      )
        differences.push(`${base.fixtureId}: corpus hash differs`)
    }
    for (const base of baseline.results) {
      const now = report.results.find(
        (r) => r.fixtureId === base.fixtureId && r.layout === base.layout
      )
      const label = `${base.fixtureId}/${base.layout}`
      if (!now) {
        differences.push(`${label}: missing from run`)
        continue
      }
      if (now.pdf.status !== 'measured' || base.pdf.status !== 'measured') {
        if (now.pdf.status !== base.pdf.status)
          differences.push(`${label}: PDF availability changed`)
        continue
      }
      if (now.pdf.value.pages !== base.pdf.value.pages)
        differences.push(`${label}: pages ${base.pdf.value.pages} -> ${now.pdf.value.pages}`)
      const delta = Math.abs(now.pdf.value.bytes - base.pdf.value.bytes) / base.pdf.value.bytes
      if (delta * 100 > tolerances.bytesPct)
        differences.push(`${label}: size changed ${(delta * 100).toFixed(1)}%`)
      const failed = now.checks.filter((x) => !x.ok).map((x) => x.name)
      if (failed.length) differences.push(`${label}: failed checks ${failed.join('; ')}`)
    }
    return { status: differences.length ? 'differs' : 'same', differences }
  }
}

export type Check = { name: string; ok: boolean; detail?: string }
export type Inspection = { pages: number; imagesPerPage: number[]; text: string[] }
type PdfValue = {
  bytes: number
  sha256: string
  pages: number
  imagesPerPage: number[]
  renderMs: number
  inspectMs: number
  previewWarning: boolean
}
export type CaseResult = {
  fixtureId: string
  revision: number
  layout: Layout
  projectionVersion: string | null
  html: Availability<{ bytes: number; sha256: string; ms: number }>
  pdf: Availability<PdfValue>
  checks: Check[]
}
export type Report = {
  schemaVersion: 1
  runId: string
  createdAt: string
  corpusVersion: string
  cases: {
    fixtureId: string
    revision: number
    variant: string
    contentHash: string
    sourceManifestHash: string
    assetHashes: string[]
  }[]
  environment: Environment
  generation: { calls: 0; note: string }
  claims: ReturnType<OutputBaselineService['summarizeClaims']>
  validationProblems: string[]
  results: CaseResult[]
  ok: boolean
}
export type Comparison = { status: 'same' | 'differs' | 'not_comparable'; differences: string[] }
export type Environment = {
  os: string
  arch: string
  node: string
  gitCommit: Availability<string>
  gitDirty: Availability<boolean>
  lockfileSha256: Availability<string>
  playwright: Availability<string>
  chromium: Availability<string>
  fontSha256: Availability<string>
  pymupdf: Availability<string>
}
export type Renderer = {
  html(
    content: TipTapDocument,
    options: { publication: boolean; preview: boolean }
  ): Promise<string>
  pdf(content: TipTapDocument, options: { publication: boolean; preview: boolean }): Promise<Buffer>
}
export type RenderOptions = {
  layouts: Layout[]
  outputDir: string
  renderer: Renderer
  inspector: (pdfPath: string) => Promise<Inspection>
  environment: () => Promise<Environment>
  clock: () => number
  now: () => Date
}

const unavailable = (error: unknown) => ({
  status: 'unavailable' as const,
  value: null,
  reason: error instanceof Error ? error.message : String(error),
})

/** Default environment capture; every field degrades to an explicit reason. */
export async function captureEnvironment(root: string, python: string): Promise<Environment> {
  const recorded = <T>(value: T, method: string): Availability<T> => ({
    status: 'recorded',
    value,
    method,
  })
  const git = (...args: string[]) => run('git', args, { cwd: root }).then((r) => r.stdout.trim())
  const attempt = async <T>(fn: () => Promise<T>, method: string): Promise<Availability<T>> => {
    try {
      return recorded(await fn(), method)
    } catch (error) {
      return unavailable(error)
    }
  }
  const { chromium } = await import('playwright')
  return {
    os: process.platform,
    arch: process.arch,
    node: process.version,
    gitCommit: await attempt(() => git('rev-parse', 'HEAD'), 'git rev-parse HEAD'),
    gitDirty: await attempt(async () => {
      const status = await git('status', '--porcelain')
      return status.length > 0
    }, 'git status --porcelain'),
    lockfileSha256: await attempt(
      async () => sha256(await readFile(path.join(root, 'bun.lock'))),
      'sha256 bun.lock'
    ),
    playwright: await attempt(
      async () =>
        JSON.parse(await readFile(path.join(root, 'node_modules/playwright/package.json'), 'utf8'))
          .version,
      'installed package manifest'
    ),
    chromium: await attempt(async () => {
      const browser = await chromium.launch()
      try {
        return browser.version()
      } finally {
        await browser.close()
      }
    }, 'browser.version()'),
    fontSha256: await attempt(
      async () =>
        sha256(
          await readFile(
            new URL(
              import.meta
                .resolve('@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2')
            )
          )
        ),
      'sha256 embedded Manrope woff2'
    ),
    pymupdf: await attempt(async () => {
      const { stdout } = await run(python, [
        '-I',
        '-c',
        'import pymupdf;print(pymupdf.VersionBind)',
      ])
      return stdout.trim()
    }, 'pymupdf.VersionBind'),
  }
}

const INSPECT = `
import json, sys, pymupdf
doc = pymupdf.open(sys.argv[1])
print(json.dumps({
  "pages": doc.page_count,
  "imagesPerPage": [len(p.get_images()) for p in doc],
  "text": [p.get_text() for p in doc],
}))
`

/** Bounded PyMuPDF inspection: page count, per-page images and text. */
export const pymupdfInspector =
  (python: string) =>
  async (pdfPath: string): Promise<Inspection> => {
    const { stdout } = await run(python, ['-I', '-c', INSPECT, pdfPath], {
      timeout: 60_000,
      maxBuffer: 32 * 1024 * 1024,
    })
    return JSON.parse(stdout)
  }
