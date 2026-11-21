/* eslint-disable @unicorn/no-await-expression-member -- terse assertions on awaited results */
import { test } from '@japa/runner'
import { copyFile, mkdir, mkdtemp, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ExportPdfService from '#services/exports/pdf_service'
import { inspectPdf } from '#services/exports/pdf_inspector'
import { planLayout } from '../../shared/layout/plan.ts'
import { inspectPages } from '../../shared/layout/fit.ts'
import { getTemplate } from '../../shared/layout/templates.ts'
import { getBrandKit } from '../../shared/layout/brand.ts'
import * as fx from '../fixtures/layout/entries.ts'

/**
 * Native RND-02/03 acceptance: real Chromium renders each template and PyMuPDF
 * inspects the bytes. Opt in with LAYOUT_NATIVE_PDF=1. Once enabled it never
 * skips: a missing Chromium or inspector fails instead of passing silently.
 */
const enabled = process.env.LAYOUT_NATIVE_PDF === '1'
const brand = getBrandKit('humblebee')!

async function pdf(data: typeof fx.entry01, templateId: string, options = {}) {
  const template = getTemplate(templateId)!
  const buffer = await ExportPdfService.generate(data, {
    layout: planLayout(data, template, brand, options),
  })
  const dir = await mkdtemp(path.join(tmpdir(), 'layout-pdf-'))
  const file = path.join(dir, 'out.pdf')
  await writeFile(file, buffer)
  // Optional: keep the PDFs for visual review and for `node ace pdf:inspect`.
  if (process.env.LAYOUT_PDF_OUT) {
    await mkdir(process.env.LAYOUT_PDF_OUT, { recursive: true })
    await copyFile(
      file,
      path.join(
        process.env.LAYOUT_PDF_OUT,
        `${templateId}-${data.body.length}-${data.sources.length}.pdf`
      )
    )
  }
  return { file, bytes: (await stat(file)).size, report: await inspectPdf(file) }
}

test.group('Native PDF layout (RND-02/03)', () => {
  test('entry 01 fits one page concise and at most two standard, with sources counted', async ({
    assert,
  }) => {
    const concise = await pdf(fx.entry01, 'case_study_concise')
    assert.equal(concise.report.pages, 1)
    const standard = await pdf(fx.entry01, 'case_study_standard')
    assert.isAtMost(standard.report.pages, 2)
    assert.include(concise.report.text, 'Customs brief')
  })
    .timeout(90_000)
    .skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')

  test('the mockup entry (stat band, steps, cards, roadmap, CTA) fits one concise page', async ({
    assert,
  }) => {
    const out = await pdf(fx.brandedClient, 'case_study_concise', {
      cta: {
        label: 'Talk to our team',
        href: 'https://example.com/contact',
        headline: 'Building document automation that has to stay in-house?',
      },
    })
    assert.equal(out.report.pages, 1)
    assert.deepEqual(
      inspectPages(out.report.pageStats, { budget: 1 }).filter((f) => f.severity === 'error'),
      []
    )
    for (const needle of ['Automating customs', 'UP TO'.toLowerCase(), 'roadmap', 'Upload']) {
      assert.include(out.report.text.toLowerCase(), needle.toLowerCase())
    }
  })
    .timeout(90_000)
    .skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')

  test('the hero and stat band run edge to edge, with no white slivers', async ({ assert }) => {
    const out = await pdf(fx.brandedClient, 'case_study_concise')
    const navy = out.report.bleeds.find((rect) => rect.fill === '#111111')!
    const yellow = out.report.bleeds.find((rect) => rect.fill === '#ffb902')!
    for (const rect of [navy, yellow]) {
      assert.isAtMost(rect.x0, 0.5)
      assert.isAtLeast(rect.x1, out.report.pageWidth - 0.5)
    }
    assert.isAtMost(navy.y0, 0.5)
  })
    .timeout(90_000)
    .skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')

  test('there is clear space between hero, stat band and the challenge/solution row', async ({
    assert,
  }) => {
    const out = await pdf(fx.brandedClient, 'case_study_concise')
    const navy = out.report.bleeds.find((rect) => rect.fill === '#111111')!
    const yellow = out.report.bleeds.find((rect) => rect.fill === '#ffb902')!
    // 7mm of white space below the blue hero.
    assert.isAtLeast(yellow.y0 - navy.y1, 18)
    const challenge = out.report.textBlocks.find((b) => /THE CHALLENGE/i.test(b.text))!
    assert.isAtLeast(challenge.y0 - yellow.y1, 22)
  })
    .timeout(90_000)
    .skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')

  test('the blue hero keeps clear space below its last line', async ({ assert }) => {
    const out = await pdf(fx.brandedClient, 'case_study_concise')
    const navy = out.report.bleeds.find((rect) => rect.fill === '#111111')!
    // The subhead is the last text in the hero; its bottom must sit well above the band edge.
    assert.isAtLeast(navy.y1 - out.report.heroTextBottom, 24)
  })
    .timeout(90_000)
    .skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')

  test('no clipped text, no unintended near-empty pages, fonts embedded and not Type 3', async ({
    assert,
  }) => {
    const out = await pdf(fx.entry01, 'case_study_standard')
    const findings = inspectPages(out.report.pageStats, { budget: 2 })
    assert.deepEqual(
      findings.filter((f) => f.severity === 'error'),
      []
    )
    assert.isNotEmpty(out.report.fonts)
    assert.isFalse(
      out.report.fonts.some((f) => f.type === 'Type3'),
      'Type 3 font embedded'
    )
    assert.isTrue(out.report.fonts.every((f) => f.embedded))
    assert.isAbove(out.report.text.length, 200, 'text must be selectable')
  })
    .timeout(90_000)
    .skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')

  test('an overflowing entry is reported over budget rather than silently shrunk', async ({
    assert,
  }) => {
    const out = await pdf(fx.overflowing, 'case_study_standard')
    const findings = inspectPages(out.report.pageStats, { budget: 2 })
    assert.include(
      findings.map((f) => f.code),
      'page_budget_exceeded'
    )
  })
    .timeout(90_000)
    .skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')

  test('client PDF text never contains reviewer-only or internal content', async ({ assert }) => {
    const out = await pdf(fx.entry01, 'case_study_standard')
    for (const forbidden of ['chunk', 'reviewer', 'OUT03_PRIVATE', '/workspaces/']) {
      assert.notInclude(out.report.text.toLowerCase(), forbidden.toLowerCase())
    }
  })
    .timeout(90_000)
    .skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')

  test('links are internal-safe and the email preset stays well under 8 MB', async ({ assert }) => {
    const out = await pdf(fx.entry01, 'case_study_standard', {
      cta: { label: 'Talk to us', href: 'https://example.com/contact' },
    })
    assert.isTrue(out.report.links.every((l) => /^(https?:|mailto:|#)/.test(l)))
    assert.isBelow(out.bytes, 8 * 1024 * 1024)
  })
    .timeout(90_000)
    .skip(!enabled, 'Set LAYOUT_NATIVE_PDF=1 to run Chromium + PyMuPDF checks')
})
