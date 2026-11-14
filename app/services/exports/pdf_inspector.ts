import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import pdfWorkerConfig from '#config/pdf_worker'
import type { PageStat } from '../../../shared/layout/fit.ts'

const run = promisify(execFile)

export type PdfFont = { name: string; type: string; embedded: boolean }
export type PdfReport = {
  bytes: number
  pages: number
  text: string
  links: string[]
  internalLinks: number
  fonts: PdfFont[]
  pageStats: PageStat[]
  metadata: Record<string, string>
}

/**
 * Reads a finished PDF with PyMuPDF in a separate, isolated process (`-I`).
 * This inspects bytes (fonts, text, links, page statistics); it never renders
 * or fetches anything. A missing interpreter is an error, not a pass.
 */
export async function inspectPdf(file: string): Promise<PdfReport> {
  const script = path.join(path.dirname(pdfWorkerConfig.script), 'inspect_pdf.py')
  const { stdout } = await run(pdfWorkerConfig.python, ['-I', script, file], {
    timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(stdout) as PdfReport
}
