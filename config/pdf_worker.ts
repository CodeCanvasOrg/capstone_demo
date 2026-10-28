import path from 'node:path'
import app from '@adonisjs/core/services/app'
import env from '#start/env'

const root = app.makePath('python', 'pdf_worker')

/**
 * PyMuPDF runs in a pool of long-lived Python processes owned by the queue worker. The
 * environment is prepared once with `bun run python:setup`; nothing is installed at call time.
 */
const pdfWorkerConfig = {
  // Production keeps pdf-parse until the PyMuPDF licence and evaluation gate are signed off.
  extractor: env.get('PDF_EXTRACTOR') ?? (app.inProduction ? 'pdf-parse' : 'pymupdf'),
  python:
    env.get('PDF_WORKER_PYTHON') ??
    path.join(
      root,
      '.venv',
      ...(process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python'])
    ),
  script: path.join(root, 'worker.py'),
  poolSize: env.get('PDF_WORKER_POOL_SIZE') ?? 2,
  timeoutMs: env.get('PDF_WORKER_TIMEOUT_MS') ?? 120_000,
  maxRequests: env.get('PDF_WORKER_MAX_REQUESTS') ?? 200,
  // onnxruntime (layout analysis) otherwise starts one thread per core in every worker.
  threadsPerWorker: env.get('PDF_WORKER_THREADS') ?? 2,
}

export default pdfWorkerConfig
