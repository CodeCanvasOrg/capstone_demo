import type { PageContent, Para } from '../../../shared/brochure/content.ts'
import type { DesignId } from '../../../shared/brochure/designs.ts'

const p = (text: string): Para => ({ text, chunks: [] })
const g = (heading: string, text?: string, bullets: string[] = [], stat?: string) => ({
  heading,
  ...(stat ? { stat } : {}),
  paragraphs: text ? [p(text)] : [],
  bullets,
})
const s = (partial: Partial<PageContent['sections'][number]>): PageContent['sections'][number] => ({
  paragraphs: [],
  bullets: [],
  groups: [],
  ...partial,
})

/** A realistic page for every design, each within its limits. */
export const samples: Record<DesignId, PageContent> = {
  cover: {
    design: 'cover',
    sections: [
      s({
        title: 'Powering faster customs clearance',
        paragraphs: [p('HumbleBee AI document intelligence for customs brokers')],
      }),
    ],
  },
  proof: {
    design: 'proof',
    sections: [
      s({
        title: 'Ready to take the lead?',
        paragraphs: [
          p(
            'Customs volumes are rising faster than teams can read them. Document AI changes the economics.'
          ),
          p('We help brokers clear more declarations with the same people.'),
        ],
        groups: [
          g('Faster', 'of review time removed from each declaration at pilot sites.', [], '40%'),
          g('Cleaner', 'fewer transcription errors than manual re-keying.', [], '97%'),
          g('Wider', 'regions running the pipeline in production.', [], '12'),
        ],
        source: 'HumbleBee AI pilot report, 2026',
      }),
    ],
  },
  article: {
    design: 'article',
    sections: [
      s({
        title: 'It’s time to read documents differently',
        paragraphs: [
          p(
            'Brokers retype data from scanned invoices into declaration templates. Layouts vary by supplier.'
          ),
          p(
            'Start by automating the reading step: extraction, checks and routing for every document.'
          ),
          p('A reviewed draft replaces a blank form, and exceptions reach people sooner.'),
        ],
        bullets: [
          'Faster declarations',
          'Fewer re-keying errors',
          'Identity data stays on premise',
        ],
        groups: [
          g('Welcome to the HumbleBee review pipeline.'),
          g('Empowering your team to clear more, with less.'),
        ],
      }),
    ],
  },
  offer: {
    design: 'offer',
    sections: [
      s({
        title: 'HumbleBee Customs Intelligence',
        paragraphs: [
          p(
            'Used by brokers to read invoices, packing lists and identity documents on their own servers.'
          ),
        ],
        stat: { value: '>30', label: 'brokerages evaluating the pipeline' },
      }),
      s({
        title: 'What we offer',
        groups: [
          g(
            'Accurate extraction',
            'Computer vision and OCR digitise documents, then language models fill structured fields.'
          ),
          g(
            'Private by design',
            'No cloud APIs. Names and identity numbers never leave the perimeter.'
          ),
          g(
            'Fast to adopt',
            'Runs on existing servers and exports to the formats your staff already use.'
          ),
        ],
      }),
    ],
  },
  glance: {
    design: 'glance',
    sections: [
      s({ title: 'Manage today’s volume and tomorrow’s growth from one pipeline.' }),
      s({
        title: 'At a glance',
        paragraphs: [
          p('End-to-end review and automation'),
          p('Review interface and export service'),
          p('Orchestration'),
        ],
        groups: [
          g('Ingest', undefined, ['Upload', 'Scan', 'Email intake']),
          g('Read', undefined, ['OCR', 'Layout detection', 'Field extraction']),
          g('Check', undefined, ['Rules', 'Cross-document match', 'Anomaly flags']),
          g('Deliver', undefined, ['Review queue', 'Excel export', 'PDF export']),
        ],
      }),
      s({
        title: 'Why this pipeline?',
        bullets: [
          'Architecture: Local | Modular | Scalable | Auditable',
          'Deployment: On premise | Private cloud | Hybrid',
          'Drivers: Speed | Accuracy | Privacy | Cost',
        ],
        groups: [
          g('What sets it apart', undefined, [
            'Reviewed drafts, not blank forms',
            'Every field traced to its source',
          ]),
        ],
      }),
    ],
  },
  columns: {
    design: 'columns',
    sections: [
      s({
        title: 'Customs Intelligence portfolio',
        paragraphs: [
          p(
            'Three capabilities that take a declaration from scan to submission without re-keying.'
          ),
        ],
      }),
      s({
        title: 'Components of a faster workflow',
        paragraphs: [p('Powered by document AI')],
        groups: [
          g(
            'Read every document the first time',
            'Extraction handles invoices, packing lists and IDs.',
            ['Layout varies by supplier', 'Stamps and tables handled']
          ),
          g(
            'Check before staff look',
            'Rules and cross-document matching flag only real exceptions.',
            ['Reduces rework']
          ),
          g(
            'Hand over a reviewed draft',
            'Staff approve a filled declaration instead of building one.',
            ['Excel and PDF export']
          ),
        ],
      }),
    ],
  },
  insight: {
    design: 'insight',
    sections: [
      s({
        groups: [
          g(
            'Gain insight into where time goes',
            'Dashboards show review time by supplier and document type.',
            ['Spot slow suppliers', 'Plan staffing']
          ),
          g(
            'Keep service levels up as volume grows',
            'Queues prioritise urgent shipments automatically.',
            ['Escalate exceptions', 'Share status with clients']
          ),
          g(
            'Improve the buying experience for clients',
            'Faster clearance means earlier delivery estimates.',
            ['Fewer status calls']
          ),
        ],
      }),
    ],
  },
  recognition: {
    design: 'recognition',
    sections: [
      s({
        title: 'Proven in the field',
        paragraphs: [
          p(
            'Brokers run the pipeline daily on live declarations, across sites and document types.'
          ),
        ],
        groups: [
          g(
            'Your engine for continuous improvement',
            'New suppliers and layouts are learned as they arrive.'
          ),
        ],
      }),
      s({
        title: 'Recognition',
        groups: [
          g('Pilot of the year', undefined, ['Logistics innovation award', 'Regional finalist']),
          g('Security reviewed', undefined, ['Independent assessment']),
          g('Customer favourite', undefined, ['Top rated by brokers', 'Net promoter 62']),
        ],
      }),
    ],
  },
  contact: {
    design: 'contact',
    sections: [
      s({
        title: 'Contact us',
        groups: [g('Alex Rivera', undefined, [])].map((group) => ({
          ...group,
          paragraphs: [
            p('Head of customer success'),
            p('alex@humblebee.ai'),
            p('humblebee.ai/customs'),
          ],
        })),
      }),
      s({
        title: 'About HumbleBee AI',
        paragraphs: [
          p(
            'HumbleBee AI builds document intelligence for operations teams, with human review at every step.'
          ),
          p('Copyright 2026 HumbleBee AI. All rights reserved.'),
        ],
      }),
    ],
  },
}
