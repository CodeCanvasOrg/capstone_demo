import type DocumentVersion from '#models/document_version'
import Image from '@tiptap/extension-image'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { chromium } from 'playwright'

export default class ExportPdfService {
  static async generate(version: DocumentVersion) {
    const extensions = [StarterKit, Image]
    const contentHtml = generateHTML(version.content, extensions)

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
      <meta charset="UTF-8" />

      <style>
      @page {
      size: A4;
      margin: 20mm;
      }

      body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #111827;
      }

      h1 {
      font-size: 26pt;
      margin-bottom: 16px;
      }

      h2 {
      font-size: 20pt;
      margin-top: 32px;
      }

      h3 {
      font-size: 16pt;
      margin-top: 24px;
      }

      p {
      margin: 0 0 12px;
      }

      img {
      max-width: 100%;
      height: auto;
      }

      ul,
      ol {
      padding-left: 24px;
      }

      blockquote {
      border-left: 4px solid #ddd;
      padding-left: 16px;
      color: #555;
      }

      a {
      color: inherit;
      }
      </style>
      </head>

      <body>
      <article>
      ${contentHtml}
      </article>
      </body>
      </html>
    `

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(html, {
        waitUntil: 'networkidle',
      })

      return await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      })
    } finally {
      await browser.close()
    }
  }
}
