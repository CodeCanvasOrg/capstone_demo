import { test } from '@japa/runner'
import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import OutputBaselineService, {
  type Environment,
  type RenderOptions,
  type Report,
} from '#services/qa/output_baseline_service'

const manifest = path.resolve('tests/fixtures/output/qa01-v1/manifest.json')
const row = (authorship: string, label: string, state: string) =>
  ({ authorship, gold_label: label, review_state: state }) as Record<string, string>
const rec = <T>(value: T) => ({ status: 'recorded' as const, value, method: 'test' })
const env = (chromium = '1'): Environment => ({
  os: 'linux',
  arch: 'x64',
  node: 'v24',
  gitCommit: rec('abc'),
  gitDirty: rec(false),
  lockfileSha256: rec('l'),
  playwright: rec('1'),
  chromium: rec(chromium),
  fontSha256: rec('f'),
  pymupdf: rec('1'),
})

async function options(overrides: Partial<RenderOptions> = {}): Promise<RenderOptions> {
  return {
    layouts: ['legacy', 'pilot'],
    outputDir: path.join(await mkdtemp(path.join(tmpdir(), 'qa01-')), 'run'),
    // Real HTML so the checks exercise the true renderer; only PDF bytes are faked.
    // Real HTML so the checks exercise the true renderer; the "PDF" is the page text so the
    // text inspector below has something faithful to read. Only the browser step is faked.
    renderer: {
      html: async (content, opts) => {
        const { default: Pdf } = await import('#services/exports/pdf_service')
        return Pdf.html({ content } as any, opts)
      },
      pdf: async (content, opts) => {
        const { default: Pdf } = await import('#services/exports/pdf_service')
        const html = await Pdf.html({ content } as any, opts)
        return Buffer.from(html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' '))
      },
    },
    inspector: async (pdfPath) => ({
      pages: 2,
      imagesPerPage: [0, 0],
      text: [await readFile(pdfPath, 'utf8'), 'PREVIEW · NOT APPROVED'],
    }),
    environment: async () => env(),
    clock: (() => {
      let t = 0
      return () => (t += 5)
    })(),
    now: () => new Date('2026-11-12T00:00:00Z'),
    ...overrides,
  }
}

test.group('OutputBaselineService claims', () => {
  test('S/C/U arithmetic counts reviewed AI claims only', ({ assert }) => {
    const s = new OutputBaselineService().summarizeClaims([
      row('ai', 'supported', 'reviewed'),
      row('ai', 'contradicted', 'reviewed'),
      row('ai', 'unsupported', 'reviewed'),
      row('ai', 'supported', 'reviewed'),
      row('ai', 'unsupported', 'pending'),
      row('ai', 'supported', 'disputed'),
      row('user', '', 'exempt_user'),
      row('unknown', '', 'needs_authorship'),
    ])
    assert.equal(s.reviewedAi, 4)
    assert.equal(s.eligibleAi, 6)
    assert.equal(s.unreviewedAi, 2)
    assert.equal(s.user, 1)
    assert.equal(s.unknownAuthorship, 1)
    assert.equal(s.unsupportedOrContradictedRate.value, 0.5)
  })

  test('zero denominator is unavailable with a reason, not zero', ({ assert }) => {
    const s = new OutputBaselineService().summarizeClaims([row('ai', 'supported', 'pending')])
    assert.equal(s.unsupportedOrContradictedRate.status, 'unavailable')
    assert.isNull(s.unsupportedOrContradictedRate.value)
  })

  test('frozen sheet has no reviewed labels yet', async ({ assert }) => {
    const service = new OutputBaselineService()
    const corpus = await service.load(manifest)
    const s = service.summarizeClaims(corpus.claims)
    assert.equal(s.reviewedAi, 0)
    assert.isAbove(s.eligibleAi, 0)
  })
})

test.group('OutputBaselineService render', () => {
  test('renders both layouts with deterministic timings and passing checks', async ({ assert }) => {
    const service = new OutputBaselineService()
    const opts = await options()
    const report = await service.render(await service.load(manifest), opts)
    assert.lengthOf(report.results, 12)
    assert.isTrue(
      report.ok,
      JSON.stringify(report.results.flatMap((r) => r.checks.filter((c) => !c.ok)))
    )
    const pilot = report.results.find((r) => r.layout === 'pilot')!
    assert.equal(pilot.projectionVersion, 'out-01-pilot-1')
    assert.equal(pilot.html.status === 'measured' && pilot.html.value.ms, 5)
    assert.include(await readdir(opts.outputDir), 'report.json')
    assert.equal(
      JSON.parse(await readFile(path.join(opts.outputDir, 'report.json'), 'utf8')).runId,
      'run'
    )
  })

  test('failed PDF render reports null with a reason and a failed run', async ({ assert }) => {
    const service = new OutputBaselineService()
    const opts = await options()
    opts.renderer.pdf = async () => {
      throw new Error('E_PDF_UNAVAILABLE')
    }
    const report = await service.render(await service.load(manifest), opts)
    const pdf = report.results[0].pdf
    assert.equal(pdf.status, 'unavailable')
    assert.equal(pdf.value, null)
    assert.equal(pdf.status === 'unavailable' && pdf.reason, 'E_PDF_UNAVAILABLE')
    assert.isFalse(report.ok)
    assert.include(await readdir(opts.outputDir), 'report.json')
  })

  test('refuses to overwrite an earlier run', async ({ assert }) => {
    const service = new OutputBaselineService()
    const opts = await options({ layouts: ['legacy'] })
    const corpus = await service.load(manifest)
    await service.render(corpus, opts)
    await assert.rejects(() => service.render(corpus, opts), /already exists/)
  })

  test('pilot payload leaks no chunk IDs or excerpts', async ({ assert }) => {
    const service = new OutputBaselineService()
    const report = await service.render(
      await service.load(manifest),
      await options({ layouts: ['pilot'] })
    )
    const leaks = report.results
      .flatMap((r) => r.checks)
      .filter((c) => c.name.includes('no chunk IDs'))
    assert.isNotEmpty(leaks)
    assert.isTrue(leaks.every((c) => c.ok))
  })
})

test.group('OutputBaselineService compare', () => {
  const base = async () => {
    const service = new OutputBaselineService()
    return service.render(await service.load(manifest), await options({ layouts: ['pilot'] }))
  }

  test('identical runs are the same', async ({ assert }) => {
    const report = await base()
    assert.equal(new OutputBaselineService().compare(report, report).status, 'same')
  })

  test('environment mismatch is not comparable', async ({ assert }) => {
    const report = await base()
    const other: Report = { ...report, environment: env('2') }
    assert.equal(new OutputBaselineService().compare(other, report).status, 'not_comparable')
  })

  test('page-count and size drift are reported', async ({ assert }) => {
    const report = await base()
    const drift: Report = structuredClone(report)
    const pdf = drift.results[0].pdf
    if (pdf.status === 'measured') {
      pdf.value.pages += 1
      pdf.value.bytes *= 3
    }
    const result = new OutputBaselineService().compare(drift, report)
    assert.equal(result.status, 'differs')
    assert.match(result.differences.join('\n'), /pages/)
    assert.match(result.differences.join('\n'), /size changed/)
  })
})
