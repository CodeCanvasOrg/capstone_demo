import type { z } from 'zod'
import type { entrySchema } from '../../../shared/layout/entry.ts'

/** Mirrors the feedback mockup (entry 01), expressed in the model's output schema. */
export const brandedEntry: z.input<typeof entrySchema> = {
  doc_type: 'client_case_study',
  hero: {
    headline: 'Automating customs documentation with local AI',
    subhead:
      'Computer vision and on-premise OCR and language models that digitize invoices, packing lists and IDs for a customs brokerage.',
  },
  results: [
    {
      value: '90%',
      comparison: 'up_to',
      label: 'less time spent processing documents',
      evidence: 'estimated',
      footnote_ids: [1],
    },
    {
      value: '97%',
      label: 'reduction in transcription errors',
      evidence: 'client_reported',
      footnote_ids: [1],
    },
    {
      value: '1,000',
      label: 'declarants supported by the MVP architecture',
      evidence: 'design_target',
      footnote_ids: [2],
    },
  ],
  challenge: {
    text: 'Customs staff retyped data from scanned invoices into declaration templates. Layouts varied by supplier, so plain OCR was unreliable. Documents held identity numbers that could not go to a cloud service.',
    footnote_ids: [1],
  },
  solution: {
    text: 'An MVP that runs OCR and LLM services on the client’s own servers and fills standard Excel or PDF outputs that staff review before submission.',
    footnote_ids: [2],
  },
  steps: [
    { title: 'Upload', text: 'Invoice, packing list or ID as image or PDF.' },
    { title: 'Detect', text: 'Computer vision finds stamps, tables and field boundaries.' },
    { title: 'Extract', text: 'Local OCR and LLM pull structured fields on-premise.' },
    { title: 'Review and export', text: 'Staff check and edit, then export to Excel or PDF.' },
  ],
  capabilities: [
    {
      title: 'Data stays on-premise',
      text: 'No cloud APIs. Names and ID numbers never leave the perimeter.',
    },
    {
      title: 'Secure by design',
      text: 'Encrypted storage and an admin panel with individual credentials.',
    },
    {
      title: 'Runs on existing servers',
      text: 'Lightweight models avoid the need for GPU clusters.',
    },
  ],
  hero_image: { chunk_id: 'image-a', alt: 'A customs officer beside a document scanner' },
  roadmap:
    'Automatic document classification, deeper ERP integration, and end-to-end declaration generation.',
  footnotes: [
    {
      id: 1,
      text: 'Estimates reported in the case study; no baseline or independent measurement was published.',
      chunks: ['chunk-a'],
    },
    { id: 2, text: 'Architecture capacity target, not a measured outcome.', chunks: ['chunk-b'] },
  ],
  reviewer_notes: ['Client name and deployment dates not in the supplied material.'],
}
