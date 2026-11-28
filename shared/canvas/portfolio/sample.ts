import type { SourceInfo, PortfolioInput } from './compose.ts'

/**
 * The design's own sample document (docs/design/portfolio-template/template.html): a cover,
 * one entry and its sources page. It is what the template thumbnails, `portfolio:template:render`
 * and `portfolio:template:check` draw, so the output can be compared with the design.
 * Explicit line breaks match the design's rhythm; generated text wraps by itself.
 */
const info = (
  fileName: string,
  chunkIndex: number,
  pageNumber: number,
  chunkLabel: string,
  unit: string
): SourceInfo => ({ fileName, chunkIndex, pageNumber, chunkLabel, unit })

const DISCOVERY = 'Discovery research summary'
const PROTOTYPE = 'Service intake prototype'
const USABILITY = 'Moderated usability study'
const PILOT = 'Pilot and accessibility plan'

export const SAMPLE_SOURCES = new Map<string, SourceInfo>([
  ['sample-r01', info(DISCOVERY, 0, 3, 'R01', 'chunks')],
  ['sample-r06', info(DISCOVERY, 5, 7, 'R06', 'chunks')],
  ['sample-p01', info(PROTOTYPE, 0, 2, 'P01', 'frames')],
  ['sample-p08', info(PROTOTYPE, 7, 5, 'P08', 'frames')],
  ['sample-t01', info(USABILITY, 0, 4, 'T01', 'sessions')],
  ['sample-t05', info(USABILITY, 4, 6, 'T05', 'sessions')],
  ['sample-a01', info(PILOT, 0, 1, 'A01', 'actions')],
  ['sample-a04', info(PILOT, 3, 2, 'A04', 'actions')],
])

export const SAMPLE_FOOTER = 'Selected work · Research and product design'

export const SAMPLE: PortfolioInput = {
  footer: SAMPLE_FOOTER,
  sources: SAMPLE_SOURCES,
  cover: {
    eyebrow: 'Selected project portfolio',
    title: 'Designing the\nnext chapter of\npublic services',
    subtitle:
      'Research, prototypes and practical outcomes: a collection\nof work that makes everyday services clearer, faster\nand easier for the people who use them.',
    meta: [
      {
        label: 'Project',
        value: 'Service design and\ndigital delivery',
        secondary: 'Independent project portfolio',
      },
      { label: 'Prepared by', value: 'Alex Morgan', secondary: 'Product designer & researcher' },
      { label: 'Date', value: '26 November 2026', secondary: 'Selected work, 2025–2026' },
    ],
  },
  entries: [
    {
      page: {
        title: 'Entry 01: a clearer path to support',
        category: 'Service design',
        intro:
          'A clearer path from request to resolution for a community service team.\nResearch connected staff interviews with real service records, then turned\nthose findings into a focused intake and triage prototype. The evidence\nand project decisions are recorded on the following page.',
        sourcesIntro:
          'Supporting material for “A clearer path to support”. Superscript numbers\nin the entry point to the documents below. Locators identify the exact\npages or chunks used to support each statement.',
        rows: [
          {
            label: 'Context',
            body: 'A local service team handled requests across email and shared spreadsheets. Follow-up was difficult to track.',
            chunks: ['sample-r01'],
          },
          {
            label: 'Research',
            body: 'Six staff interviews and a review of 40 anonymised records identified repeated handoffs and missing details.',
            chunks: ['sample-r06'],
          },
          {
            label: 'Challenge',
            constraint: 'Incomplete intake led to repeat contact.',
            body: 'The design needed to clarify the next action without adding work for staff.',
            chunks: [],
          },
          {
            label: 'Approach',
            body: 'Map the journey, simplify intake and test the triage flow.',
            chunks: [],
          },
          {
            label: 'Solution',
            body: 'A guided request form, shared queue and visible status history gave the team one place to review each case.',
            chunks: ['sample-p01', 'sample-p08'],
          },
          {
            label: 'Evaluation',
            body: 'Four of five participants completed the prototype task without assistance in a moderated session.',
            chunks: ['sample-t01'],
          },
          {
            label: 'Evidence',
            body: 'Prototype findings; production impact unmeasured.',
            chunks: ['sample-t05'],
          },
          {
            label: 'Next steps',
            body: 'Validate accessibility with service users, then measure repeat contact during a limited pilot.',
            chunks: ['sample-a01', 'sample-a04'],
          },
        ],
        claims: [
          { claim: 'Repeated handoffs', row: 2, kind: 'measured', label: 'Research finding' },
          {
            claim: '4 of 5 completed the task',
            row: 6,
            kind: 'measured',
            label: 'Prototype observation',
          },
          {
            claim: 'Reduced repeat contact',
            row: 8,
            kind: 'design_target',
            label: 'Pilot objective',
          },
        ],
        sourceNotes: [
          {
            chunk: 'sample-r01',
            note: 'Interview themes, current journey and anonymised record review.',
          },
          {
            chunk: 'sample-p01',
            note: 'Guided intake, shared queue and status history in the tested flow.',
          },
          {
            chunk: 'sample-t01',
            note: 'Task outcomes for five participants; formative findings and limitations.',
          },
          {
            chunk: 'sample-a01',
            note: 'Proposed checks and measurement plan; no pilot outcomes claimed.',
          },
        ],
        evidenceNote:
          'All documents and outcomes in this sample are illustrative. In a published portfolio, include only traceable sources, preserve locator IDs and distinguish observations from future targets.',
        summary: 'Intake and triage prototype for a community service team.',
        reviewer_notes: [],
      },
      images: [],
      sampleFigure: true,
    },
  ],
}
