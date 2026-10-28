import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { countTokens } from 'gpt-tokenizer'

type Corpus = { files: string[]; questions: { question: string; expect: string[] }[] }
type Ranked = { content: string; text: string; vector: number[]; terms: Map<string, number> }

const K = [1, 3, 5]
const RRF = 60

const tokens = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}%]+/gu) ?? []

/**
 * Compares PDF preparation pipelines on a question set. Each configuration runs the real
 * extraction, chunk plan, contextualization and embedding model; ranking mirrors production
 * retrieval (dense cosine + lexical, reciprocal-rank fused). A hit is a chunk whose source text
 * contains every expected phrase. "Top-1 tokens" is the evidence size handed to the model for
 * the best hit: recall alone rewards coarse chunks that carry unrelated text along.
 */
export default class EvalRetrieval extends BaseCommand {
  static commandName = 'eval:retrieval'
  static description = 'Compare PDF extraction and contextual chunking on a retrieval question set'

  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Question set JSON', default: 'tests/eval/pdf_retrieval.json' })
  declare corpus: string

  async run() {
    const { default: app } = await import('@adonisjs/core/services/app')
    const { default: drive } = await import('@adonisjs/drive/services/main')
    const { default: pdfWorker } = await import('#config/pdf_worker')
    const { default: contextualization } = await import('#config/contextualization')
    const { default: FileService } = await import('#services/documents/files_service')
    const { default: ChunkingService } = await import('#services/documents/chunking_service')
    const { default: ContextualizationService } =
      await import('#services/documents/contextualization_service')
    const { default: EmbeddingService, embeddingInput } =
      await import('#services/documents/embedding_service')
    const { default: PdfWorkerService } = await import('#services/documents/pdf_worker_service')

    const corpus = JSON.parse(await readFile(app.makePath(this.corpus), 'utf8')) as Corpus
    const embeddings = new EmbeddingService()
    const queries = await Promise.all(
      corpus.questions.map((item) => embeddings.embedQuery(item.question))
    )
    const configurations = [
      { name: 'pdf-parse (baseline)', extractor: 'pdf-parse', context: 'none' },
      { name: 'pymupdf, no context', extractor: 'pymupdf', context: 'none' },
      { name: 'pymupdf + structural', extractor: 'pymupdf', context: 'structural' },
      ...(contextualization.provider === 'off'
        ? []
        : [
            {
              name: `pymupdf + llm (${contextualization.identity})`,
              extractor: 'pymupdf',
              context: 'llm',
            },
          ]),
    ] as const

    drive.fake()
    const rows: string[][] = []
    try {
      for (const configuration of configurations) {
        pdfWorker.extractor = configuration.extractor as typeof pdfWorker.extractor
        const chunks: Ranked[] = []
        let pages = 0
        let extractionMs = 0
        for (const file of corpus.files) {
          const name = path.basename(file)
          const key = `uploads/1/${name}`
          await drive.use().put(key, await readFile(app.makePath(file)))
          const started = performance.now()
          const extracted = await FileService.processFile(
            { uploaderId: 1, id: name, filename: name, objectKey: key },
            {
              actorId: 1,
              workspaceId: '00000000-0000-4000-8000-000000000000',
              membershipId: '00000000-0000-4000-8000-000000000000',
              membershipEpoch: 0,
            },
            async () => {}
          )
          extractionMs += performance.now() - started
          pages += new Set(extracted.blocks.map((block) => block.sourceLocator.pageNumber)).size
          const chunked = await new ChunkingService().chunk(extracted.blocks, extracted.chunkPlan)
          const prepared =
            configuration.context === 'none'
              ? chunked
              : await new ContextualizationService(
                  configuration.context === 'llm' ? undefined : null
                ).contextualize(chunked, { title: extracted.title, fileName: name }, async () => {})
          const texts = prepared.chunks.map(embeddingInput)
          const vectors = await embeddings.embedTexts(texts)
          prepared.chunks.forEach((chunk, index) => {
            const terms = new Map<string, number>()
            for (const term of tokens(texts[index])) terms.set(term, (terms.get(term) ?? 0) + 1)
            chunks.push({
              content: chunk.content,
              text: texts[index],
              vector: vectors[index],
              terms,
            })
          })
        }
        const hits = K.map(() => 0)
        let topTokens = 0
        corpus.questions.forEach((item, index) => {
          const ranking = this.rank(chunks, item.question, queries[index])
          topTokens += countTokens(ranking[0]?.content ?? '')
          const position = ranking.findIndex((chunk) =>
            item.expect.every((phrase) =>
              chunk.content.toLowerCase().includes(phrase.toLowerCase())
            )
          )
          K.forEach((k, slot) => {
            if (position >= 0 && position < k) hits[slot]++
          })
        })
        rows.push([
          configuration.name,
          String(chunks.length),
          ...hits.map((hit) => `${Math.round((hit / corpus.questions.length) * 100)}%`),
          String(Math.round(topTokens / corpus.questions.length)),
          `${Math.round(extractionMs / pages)} ms`,
        ])
      }
    } finally {
      drive.restore()
      await PdfWorkerService.shutdown()
    }

    const header = [
      'Configuration',
      'Chunks',
      ...K.map((k) => `Recall@${k}`),
      'Top-1 tokens',
      'Extract/page',
    ]
    const widths = header.map((cell, column) =>
      Math.max(cell.length, ...rows.map((row) => row[column].length))
    )
    const line = (cells: string[]) =>
      `| ${cells.map((cell, i) => cell.padEnd(widths[i])).join(' | ')} |`
    this.logger.log(`${corpus.questions.length} questions over ${corpus.files.length} files`)
    this.logger.log(line(header))
    this.logger.log(line(widths.map((width) => '-'.repeat(width))))
    for (const row of rows) this.logger.log(line(row))
  }

  /** Dense cosine and BM25 rankings fused like production retrieval (1 / (60 + rank)). */
  private rank(chunks: Ranked[], question: string, query: number[]) {
    const cosine = (a: number[], b: number[]) => {
      let dot = 0
      let left = 0
      let right = 0
      for (const [i, element] of a.entries()) {
        dot += element * b[i]
        left += element * element
        right += b[i] * b[i]
      }
      return dot / (Math.sqrt(left) * Math.sqrt(right) || 1)
    }
    const terms = [...new Set(tokens(question))]
    const lengths = chunks.map((chunk) => [...chunk.terms.values()].reduce((a, b) => a + b, 0))
    const average = lengths.reduce((a, b) => a + b, 0) / Math.max(chunks.length, 1)
    const bm25 = (chunk: Ranked, index: number) =>
      terms.reduce((score, term) => {
        const frequency = chunk.terms.get(term) ?? 0
        if (!frequency) return score
        const containing = chunks.filter((item) => item.terms.has(term)).length
        const idf = Math.log(1 + (chunks.length - containing + 0.5) / (containing + 0.5))
        return (
          score +
          (idf * frequency * 2.2) / (frequency + 1.2 * (0.25 + (0.75 * lengths[index]) / average))
        )
      }, 0)
    const dense = chunks
      .map((chunk, index) => ({ index, score: cosine(query, chunk.vector) }))
      .sort((a, b) => b.score - a.score)
    const lexical = chunks
      .map((chunk, index) => ({ index, score: bm25(chunk, index) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
    const fused = new Map<number, number>()
    for (const list of [dense, lexical])
      list.forEach((item, rank) =>
        fused.set(item.index, (fused.get(item.index) ?? 0) + 1 / (RRF + rank + 1))
      )
    return [...fused.entries()].sort((a, b) => b[1] - a[1]).map(([index]) => chunks[index])
  }
}
