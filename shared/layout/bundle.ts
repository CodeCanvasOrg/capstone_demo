import { hashOf } from './hash.ts'

/**
 * The exact inputs an approval covers (APR-01, EDT-02). Any change to content,
 * template, brand, options, assets or renderer yields a different hash, so a
 * stale approval can never authorize a different output. Provider keys and
 * reviewer notes are deliberately not part of a bundle.
 */
export type ReviewBundle = {
  contentHash: string
  versionId: string
  template: { id: string; version: number }
  brand: { id: string; version: number }
  options: Record<string, unknown>
  assetIds: string[]
  rendererVersion: string
  /** Hashes of the pinned template and brand definitions, so an edit under the same version still shows. */
  definitions?: { template: string; brand: string }
}

export const bundleHash = (bundle: ReviewBundle) =>
  hashOf({ ...bundle, assetIds: [...bundle.assetIds].sort() })

export type ApprovalRecord = { bundleHash: string; approvedById: number }

export const approvalState = (
  approval: ApprovalRecord | undefined,
  current: ReviewBundle
): 'none' | 'current' | 'stale' =>
  !approval ? 'none' : approval.bundleHash === bundleHash(current) ? 'current' : 'stale'

export type Finding = { code: string; severity: 'error' | 'warning' }

export type ExportDecision =
  | { ok: true }
  | { ok: false; reason: 'not_approved' | 'stale_approval' }
  | { ok: false; reason: 'blocking_findings'; codes: string[] }

/**
 * Final export needs a current approval and no error-severity findings.
 * Approval never bypasses unresolved factual or severe rendering failures;
 * informational warnings may be resolved by the reviewer.
 */
export function canExport(
  approval: ApprovalRecord | undefined,
  current: ReviewBundle,
  findings: Finding[]
): ExportDecision {
  const state = approvalState(approval, current)
  if (state === 'none') return { ok: false, reason: 'not_approved' }
  if (state === 'stale') return { ok: false, reason: 'stale_approval' }
  const blocking = findings.filter((finding) => finding.severity === 'error')
  if (blocking.length)
    return { ok: false, reason: 'blocking_findings', codes: blocking.map((f) => f.code) }
  return { ok: true }
}
