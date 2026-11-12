import { test } from '@japa/runner'
import path from 'node:path'
import OutputBaselineService, {
  REQUIRED_CASES,
  canonicalJson,
  csvDisplay,
  parseCsv,
  resolveAsset,
  sha256,
  type Corpus,
} from '#services/qa/output_baseline_service'

const manifest = path.resolve('tests/fixtures/output/qa01-v1/manifest.json')
const load = async () => new OutputBaselineService().load(manifest)
const clone = async (): Promise<Corpus> => {
  const corpus = await load()
  return { ...corpus, cases: structuredClone(corpus.cases), claims: structuredClone(corpus.claims) }
}
const problems = (corpus: Corpus) => new OutputBaselineService().validate(corpus)

test.group('QA-01 fixture contract', () => {
  test('frozen corpus is valid and has the six required scenarios', async ({ assert }) => {
    const corpus = await load()
    assert.deepEqual(problems(corpus), [])
    for (const id of REQUIRED_CASES) assert.isTrue(corpus.cases.some((c) => c.fixtureId === id))
  })

  test('no-image and no-metric expectations match the actual bodies', async ({ assert }) => {
    const corpus = await load()
    const find = (id: string) => corpus.cases.find((c) => c.fixtureId === id)!
    assert.notInclude(JSON.stringify(find('qa01-no-image').content), '"image"')
    assert.equal(find('qa01-entry-01').expectations.imageCount, 1)
    assert.isNotEmpty(find('qa01-no-metric').expectations.forbiddenPatterns)
  })

  test('long-citations has 12 chunks over six long source names', async ({ assert }) => {
    const corpus = await load()
    const c = corpus.cases.find((x) => x.fixtureId === 'qa01-long-citations')!
    assert.lengthOf(c.sources, 12)
    assert.isTrue(c.sources.every((s) => s.fileName.length >= 160))
  })

  test('content, source and claim drift is detected', async ({ assert }) => {
    const a = await clone()
    a.cases[1].content.content[1].content![0].text = 'edited'
    assert.include(problems(a).join('\n'), 'content hash drift')

    const b = await clone()
    b.cases[1].sources[0].content = 'edited'
    assert.include(problems(b).join('\n'), 'source hash drift')

    const c = await clone()
    c.claims[0].text = 'edited'
    assert.include(problems(c).join('\n'), 'text hash drift')
  })

  test('duplicate and dangling identities fail', async ({ assert }) => {
    const a = await clone()
    a.cases.push(a.cases[0])
    assert.include(problems(a).join('\n'), 'Duplicate case')

    const b = await clone()
    b.cases[1].sources[0].chunkId = '00000000-0000-4000-8000-000000000000'
    assert.include(problems(b).join('\n'), 'dangling')
  })

  test('traversal and remote assets are rejected', ({ assert }) => {
    const dir = path.resolve('tests/fixtures/output/qa01-v1')
    assert.throws(() => resolveAsset(dir, '../../etc/passwd'), /escapes/)
    assert.throws(() => resolveAsset(dir, 'https://example.com/a.png'), /Remote/)
    assert.throws(() => resolveAsset(dir, '//example.com/a.png'), /Remote/)
    assert.include(resolveAsset(dir, 'assets/diagram.png'), 'diagram.png')
  })

  test('sanitized corpus carries no private URLs or metadata', async ({ assert }) => {
    const corpus = await load()
    const dump = JSON.stringify(corpus.cases.map((c) => [c.content, c.sources]))
    assert.notMatch(dump, /\/workspaces\/|https?:\/\/|fileUrl|chunkText/)
  })

  test('canonical hashing ignores key order but not array order', ({ assert }) => {
    assert.equal(canonicalJson({ b: 1, a: [1, 2] }), canonicalJson({ a: [1, 2], b: 1 }))
    assert.notEqual(canonicalJson({ a: [1, 2] }), canonicalJson({ a: [2, 1] }))
    assert.equal(sha256('x').length, 64)
  })

  test('csv parsing handles quotes and display neutralizes formulas', ({ assert }) => {
    const [row] = parseCsv('a,b\n"x, ""y""",2\n')
    assert.equal(row.a, 'x, "y"')
    assert.equal(csvDisplay('=SUM(A1)'), "'=SUM(A1)")
    assert.equal(csvDisplay('plain'), 'plain')
  })
})
