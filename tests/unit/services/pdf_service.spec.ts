import { test } from '@japa/runner'
import ExportPdfService from '#services/exports/pdf_service'
import { chromium } from 'playwright'

test.group('ExportPdfService', () => {
  test('generate returns a buffer', async ({ assert }) => {
    const mockVersion = {
      schemaVersion: 1 as const,
      docType: 'case_study' as const,
      body: [
        { type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Hello PDF' }] },
      ],
      sources: [],
    }

    // Mock Playwright to avoid launching a real browser in unit tests
    const mockBrowser = {
      newPage: async () => ({
        route: async () => {},
        setContent: async () => {},
        pdf: async () => Buffer.from('mock-pdf-content'),
      }),
      close: async () => {},
    }

    // Mock chromium.launch
    const originalLaunch = chromium.launch
    ;(chromium as any).launch = async () => mockBrowser

    try {
      const pdf = await ExportPdfService.generate(mockVersion)
      assert.deepEqual(pdf, Buffer.from('mock-pdf-content'))
    } finally {
      chromium.launch = originalLaunch
    }
  })
})
