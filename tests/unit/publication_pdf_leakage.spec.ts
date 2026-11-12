import { test } from '@japa/runner'
import { execFile } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import pdfWorkerConfig from '#config/pdf_worker'
import PublicationContentService, {
  deterministicId,
} from '#services/documents/publication_content_service'
import PublicationProjectionService from '#services/documents/publication_projection_service'
import ExportPdfService from '#services/exports/pdf_service'
import type { PublicationDocument } from '../../shared/publication/content.ts'

/**
 * Native OUT-03 acceptance: real Chromium renders both layouts and PyMuPDF,
 * a separate process, extracts what a reader (or a scraper) could recover.
 * Opt in with OUT03_NATIVE_PDF=1. Once enabled it never skips: a missing
 * Chromium or inspector fails the test instead of passing silently.
 */
const enabled = process.env.OUT03_NATIVE_PDF === '1'
const run = promisify(execFile)

const INSPECT = `
import json, sys, pymupdf
doc = pymupdf.open(sys.argv[1])
print(json.dumps({
  "pages": doc.page_count,
  "text": "\\n".join(p.get_text() for p in doc),
  "links": [l.get("uri") or "" for p in doc for l in p.get_links()],
  "annotations": [str(a.info) for p in doc for a in p.annots() or []],
  "metadata": doc.metadata,
}))
`

const SENTINELS = [
  'OUT03_PRIVATE_NOTE',
  'OUT03_PRIVATE_EXCERPT',
  '/workspaces/',
  '/Users/jane/private',
  '3f2b8c1e-9d4a-4e6b-8a7c-5d1e2f3a4b5c',
]
const UNSAFE_HREF = 'javascript:OUT03_HOSTILE'

const text = (value: string, marks?: unknown[]) => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
})

/** Synthetic hostile document: private data in every place the old path leaked it. */
function hostile(): PublicationDocument {
  const doc: PublicationDocument = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [text('Faster onboarding')] },
      {
        type: 'paragraph',
        content: [
          text('How the team cut onboarding time.'),
          {
            type: 'sourceCitation',
            attrs: {
              sourceChunkId: '3f2b8c1e-9d4a-4e6b-8a7c-5d1e2f3a4b5c',
              chunkText: 'OUT03_PRIVATE_EXCERPT',
              fileName: '/Users/jane/private/evidence.pdf',
              fileUrl: '/workspaces/w1/documents/d1/evidence/x',
              pageNumber: 3,
            },
          },
        ],
      },
      { type: 'heading', attrs: { level: 2 }, content: [text('Results')] },
      {
        type: 'paragraph',
        content: [
          text('Onboarding took weeks; up to 30% faster is the design target. '),
          text('Public site', [
            { type: 'link', attrs: { href: 'https://example.com/case-study' } },
          ]),
        ],
      },
    ],
  }
  const service = new PublicationContentService()
  const { document } = service.mapLegacy(doc, 'out03')
  const paragraph = document.content[3]
  const nodeId = paragraph.attrs!.nodeId as string
  const claimId = deterministicId('claim')
  const phrase = 'up to 30%'
  const from = (paragraph.content![0].text as string).indexOf(phrase)
  const meta = document.attrs!.publication as any
  meta.claims = [
    {
      id: claimId,
      state: 'active',
      text: service.anchor(document, nodeId, 0, 40),
      authorship: 'unknown',
      evidenceRefIds: [],
    },
  ]
  meta.results = [
    {
      id: deterministicId('result'),
      state: 'active',
      claimId,
      value: service.anchor(document, nodeId, from, from + phrase.length),
      qualifier: 'design_target',
      units: '%',
      baseline: 'Q1 onboarding',
    },
  ]
  meta.reviewerNotes = [{ id: deterministicId('note'), message: 'OUT03_PRIVATE_NOTE' }]
  return document
}

test.group('Native PDF leakage (OUT-03)', () => {
  for (const publication of [false, true])
    test(`${publication ? 'pilot' : 'legacy'} layout: no private data, qualifiers present`, async ({
      assert,
    }) => {
      if (!enabled) return
      const { client } = new PublicationProjectionService().project(hostile())

      // Structural check on the exact payload the layout receives.
      const payload = JSON.stringify(client)
      for (const secret of [...SENTINELS, 'nodeId', 'sourceChunkId', 'chunkText'])
        assert.notInclude(payload, secret)

      const pdf = await ExportPdfService.generate(client, { publication })
      const dir = await mkdtemp(path.join(tmpdir(), 'out03-'))
      const file = path.join(dir, `${publication ? 'pilot' : 'legacy'}.pdf`)
      await writeFile(file, pdf)
      const { stdout } = await run(pdfWorkerConfig.python, ['-I', '-c', INSPECT, file], {
        timeout: 60_000,
        maxBuffer: 32 * 1024 * 1024,
      })
      const out = JSON.parse(stdout) as {
        pages: number
        text: string
        links: string[]
        annotations: string[]
        metadata: Record<string, string>
      }

      assert.isAbove(out.pages, 0)
      // Forbidden sentinels are absent from text, links, annotations and metadata.
      const everything = [
        out.text,
        ...out.links,
        ...out.annotations,
        JSON.stringify(out.metadata),
      ].join('\n')
      for (const secret of [...SENTINELS, UNSAFE_HREF]) assert.notInclude(everything, secret)
      for (const uri of out.links) assert.match(uri, /^https?:\/\/|^mailto:/)

      // Required content and the qualifier beside its value survive in the PDF itself.
      const flat = out.text.replace(/\s+/g, ' ')
      assert.include(flat, 'Faster onboarding')
      assert.include(flat, 'up to 30%')
      assert.include(flat.toLowerCase(), 'design target')
      assert.include(flat, 'baseline: Q1 onboarding')
      assert.include(flat, 'Source 1') // unusable file name becomes a neutral label
    })
})
