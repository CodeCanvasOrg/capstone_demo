import { test } from '@japa/runner'
import { RunnableLambda } from '@langchain/core/runnables'
import OutlineTemplateService from '#services/documents/outline_template_service'
import OpenRouterService from '#services/open_router_service'
import ExportPdfService from '#services/exports/pdf_service'
import type { ClientRenderData } from '../../shared/publication/client.ts'
import { chromium } from 'playwright'
import { COMPANY_TEMPLATE_IDS, outlineSections } from '../../shared/templates/outlines.ts'

test.group('Company output guides', () => {
  test('loads versioned company Markdown and rejects arbitrary paths', async ({ assert }) => {
    const service = new OutlineTemplateService()
    for (const id of COMPANY_TEMPLATE_IDS) {
      const template = await service.resolve(id, { legacy: true })
      assert.match(template.revision, /^[a-f0-9]{64}$/)
      assert.include(template.definition.instructions, 'Never invent percentages')
      assert.equal(outlineSections(template.definition.outline)[1].heading, 'Executive Summary')
      assert.notProperty(template, 'editable')
    }
    await assert.rejects(() => service.resolve('../../.env'))
  })
  test('passes the complete guide to the model and assembles ordered editable sections', async ({
    assert,
  }) => {
    const template = await new OutlineTemplateService().resolve('technical')
    const service = new OpenRouterService()
    let captured: any
    const chain = RunnableLambda.from(async (messages: unknown) => {
      captured = messages
      return {
        sections: outlineSections(template.definition.outline).map((section) => ({
          key: section.key,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text:
                    section.key === 'section_2'
                      ? 'Source-backed challenge'
                      : 'Information for this section has not been provided.',
                },
              ],
            },
          ],
        })),
      }
    })
    ;(service as any).model = { withStructuredOutput: () => chain }
    let guards = 0
    const result = await service.generateOutlineWithEvidence(
      'Project title',
      'Supplied brief',
      [],
      template.definition,
      async () => {
        guards++
      }
    )
    assert.include(captured[0].content, template.definition.instructions)
    assert.include(captured[1].content[0].text, 'Supplied brief')
    assert.equal(guards, 1)
    assert.deepEqual(
      result.content
        .filter((node) => node.type === 'heading')
        .map((node) => node.content?.[0].text),
      [
        'Project title',
        ...outlineSections(template.definition.outline)
          .slice(1)
          .map((section) => section.heading),
      ]
    )
    assert.include(JSON.stringify(result), 'Source-backed challenge')
    assert.include(JSON.stringify(result), 'Information for this section has not been provided.')
    assert.notInclude(JSON.stringify(result), '<Insert')
  })
  test('HTML preview avoids Chromium and launch failures have safe actionable errors', async ({
    assert,
  }) => {
    const original = chromium.launch
    let launches = 0
    chromium.launch = async () => {
      launches++
      throw new Error('Sensitive OS trace')
    }
    const version: ClientRenderData = {
      schemaVersion: 1,
      docType: 'case_study',
      body: [{ type: 'paragraph', content: [{ type: 'text', text: 'Preview content' }] }],
      sources: [],
    }
    try {
      assert.include(await ExportPdfService.html(version, { preview: true }), 'Preview content')
      assert.equal(launches, 0)
      await assert.rejects(() => ExportPdfService.generate(version), /Print → Save as PDF/)
      assert.equal(launches, 1)
    } finally {
      chromium.launch = original
    }
  })
})
