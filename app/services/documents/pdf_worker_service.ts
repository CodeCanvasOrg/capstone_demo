import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'

import logger from '@adonisjs/core/services/logger'
import { z } from 'zod'

import config from '#config/pdf_worker'

const PROTOCOL = 1
const HANDSHAKE_TIMEOUT_MS = 30_000

export type PdfWorkerErrorCode =
  'not_set_up' | 'encrypted' | 'corrupt' | 'too_many_pages' | 'timeout' | 'crashed' | 'internal'

const SAFE_MESSAGES: Record<PdfWorkerErrorCode, string> = {
  not_set_up: 'PDF processing is not set up. Run `bun run python:setup` and restart the worker.',
  encrypted: 'This PDF is password protected. Upload an unlocked copy.',
  corrupt: 'This PDF is damaged or not a valid PDF.',
  too_many_pages: 'This PDF has too many pages to prepare.',
  timeout: 'Preparing this PDF took too long. Try again or upload a smaller file.',
  crashed: 'PDF processing stopped unexpectedly. Try again.',
  internal: 'The PDF could not be processed.',
}

export class PdfWorkerError extends Error {
  constructor(
    readonly code: PdfWorkerErrorCode,
    detail?: string
  ) {
    super(SAFE_MESSAGES[code])
    if (detail) this.cause = detail
  }
  /** Retrying the same bytes cannot succeed. */
  get permanent() {
    return ['not_set_up', 'encrypted', 'corrupt', 'too_many_pages'].includes(this.code)
  }
}

const helloSchema = z.object({
  protocol: z.number(),
  python: z.string(),
  pymupdf: z.string(),
  extractor: z.string(),
})
export type PdfWorkerHello = z.infer<typeof helloSchema>

const replySchema = z.object({
  id: z.string().nullable(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
})

type Pending = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

class WorkerProcess {
  private child: ChildProcessWithoutNullStreams
  private pending = new Map<string, Pending>()
  readonly ready: Promise<PdfWorkerHello>
  requests = 0
  busy = false
  alive = true

  constructor() {
    this.child = spawn(config.python, ['-I', '-X', 'utf8', config.script], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? os.homedir(),
        TMPDIR: os.tmpdir(),
        OMP_NUM_THREADS: String(config.threadsPerWorker),
        PYTHONUNBUFFERED: '1',
      },
    })
    createInterface({ input: this.child.stdout }).on('line', (line) => this.onReply(line))
    createInterface({ input: this.child.stderr }).on('line', (line) => {
      if (line.trim()) logger.debug({ pdfWorker: this.child.pid }, line.slice(0, 500))
    })
    this.child.on('error', (error) => this.fail(new PdfWorkerError('not_set_up', error.message)))
    this.child.on('exit', (code, signal) =>
      this.fail(new PdfWorkerError('crashed', `exit ${code ?? signal}`))
    )
    // An idle pool must never keep Node alive; a pending request's timeout timer does instead.
    this.child.unref()
    for (const stream of [this.child.stdin, this.child.stdout, this.child.stderr])
      (stream as unknown as { unref?: () => void }).unref?.()
    this.ready = this.request('hello', {}, HANDSHAKE_TIMEOUT_MS).then((value) => {
      const hello = helloSchema.parse(value)
      if (hello.protocol !== PROTOCOL)
        throw new PdfWorkerError('not_set_up', `protocol ${hello.protocol} != ${PROTOCOL}`)
      return hello
    })
    this.ready.catch(() => this.kill())
  }

  request(op: string, payload: Record<string, unknown>, timeoutMs = config.timeoutMs) {
    if (!this.alive) return Promise.reject(new PdfWorkerError('crashed'))
    const id = randomUUID()
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new PdfWorkerError('timeout'))
        this.kill()
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.child.stdin.write(`${JSON.stringify({ id, op, ...payload })}\n`)
    })
  }

  close() {
    this.alive = false
    this.child.stdin.end()
  }

  kill() {
    this.alive = false
    this.child.kill('SIGKILL')
  }

  private onReply(line: string) {
    let reply: z.infer<typeof replySchema>
    try {
      reply = replySchema.parse(JSON.parse(line))
    } catch {
      logger.warn({ pdfWorker: this.child.pid }, 'Ignoring a malformed PDF worker reply')
      return
    }
    const pending = reply.id ? this.pending.get(reply.id) : undefined
    if (!pending) return
    this.pending.delete(reply.id!)
    clearTimeout(pending.timer)
    if (reply.ok) pending.resolve(reply.result)
    else {
      const code = (reply.error?.code ?? 'internal') as PdfWorkerErrorCode
      pending.reject(
        new PdfWorkerError(code in SAFE_MESSAGES ? code : 'internal', reply.error?.message)
      )
    }
  }

  private fail(error: PdfWorkerError) {
    this.alive = false
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
      this.pending.delete(id)
    }
  }
}

type Waiter = { resolve: (worker: WorkerProcess) => void; reject: (error: Error) => void }

/**
 * Pool of long-lived PyMuPDF workers. Processes start lazily on the first PDF, stay warm, run one
 * request at a time and are recycled after `maxRequests`. Only the queue worker ever calls this.
 */
export default class PdfWorkerService {
  private static pool: WorkerProcess[] = []
  private static waiting: Waiter[] = []

  async hello() {
    return PdfWorkerService.run((worker) => worker.ready)
  }

  /**
   * Runs `op` on a copy of `bytes` in a private temp directory. `read` receives the worker result
   * and the output directory before it is removed, so figure files can be loaded.
   */
  async withDocument<T>(
    op: string,
    bytes: Buffer,
    options: Record<string, unknown>,
    read: (result: unknown, outDir: string) => Promise<T>
  ): Promise<T> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'capstone-pdf-'))
    try {
      const input = path.join(dir, 'input.pdf')
      const outDir = path.join(dir, 'out')
      await writeFile(input, bytes)
      const result = await PdfWorkerService.run((worker) =>
        worker.request(op, { path: input, outDir, options })
      )
      return await read(result, outDir)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  static readOutput(outDir: string, file: string) {
    const resolved = path.resolve(outDir, file)
    if (!resolved.startsWith(path.resolve(outDir) + path.sep))
      throw new PdfWorkerError('internal', `output outside its directory: ${file}`)
    return readFile(resolved)
  }

  static async shutdown() {
    for (const worker of this.pool) worker.close()
    this.pool = []
  }

  private static async run<T>(task: (worker: WorkerProcess) => Promise<T>): Promise<T> {
    const worker = await this.acquire()
    try {
      await worker.ready
      return await task(worker)
    } finally {
      this.release(worker)
    }
  }

  private static acquire(): Promise<WorkerProcess> {
    this.pool = this.pool.filter((worker) => worker.alive)
    const idle = this.pool.find((worker) => !worker.busy)
    if (idle) {
      idle.busy = true
      return Promise.resolve(idle)
    }
    if (this.pool.length < Math.max(1, config.poolSize)) {
      if (!existsSync(config.python))
        return Promise.reject(new PdfWorkerError('not_set_up', config.python))
      const worker = new WorkerProcess()
      worker.busy = true
      this.pool.push(worker)
      return Promise.resolve(worker)
    }
    return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }))
  }

  private static release(worker: WorkerProcess) {
    worker.requests++
    if (worker.alive && worker.requests >= config.maxRequests) worker.close()
    const next = this.waiting.shift()
    if (worker.alive) {
      if (next) next.resolve(worker)
      else worker.busy = false
      return
    }
    // A retired or crashed worker frees its slot; hand the next waiter a fresh process.
    this.pool = this.pool.filter((item) => item !== worker)
    if (next) this.acquire().then(next.resolve, next.reject)
  }
}

process.once('exit', () => {
  void PdfWorkerService.shutdown()
})
