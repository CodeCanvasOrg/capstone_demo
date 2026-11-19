
import { createHash } from 'node:crypto'
import DocumentIssue from '#models/document_issue'
import ClaimEvaluationService, {
  type ClaimEvidence,
  type ClaimInput,
} from '#services/documents/claim_evaluation_service'
import type { WorkspaceAccessContext } from '#services/workspaces/access_service'

type Node = {
  type?: string
  text?: string
  attrs?: Record<string, any>
  content?: Node[]
}
export type ExtractedClaim = ClaimInput & { blockId: string; fileNames: string[] }

const MAX_CLAIMS = 40
const CONCURRENCY = 4
const text = (node: Node): string =>
  node.type === 'sourceCitation' ? '' : (node.text ?? (node.content ?? []).map(text).join(''))
const citations = (node: Node): Node[] =>
  node.type === 'sourceCitation' ? [node] : (node.content ?? []).flatMap(citations)
const excerpt = (value: string) => (value.length > 90 ? `${value.slice(0, 87)}...` : value)

/**
 * Generated blocks that cite sources are the checkable claims: the block text is judged against
 * the cited chunks. Uncited prose is not a factual claim this review can check.
 */
export function extractClaims(content: Node): ExtractedClaim[] {
  const claims: ExtractedClaim[] = []
  const walk = (nodes: Node[], path: string) =>
    nodes.forEach((node, index) => {
      const id = `${path}${index}`
      const cited = citations(node)
      const claim = text(node).replace(/\s+/g, ' ').trim()
      if (cited.length && claim) {
        const evidence = new Map<string, ClaimEvidence>()
        for (const item of cited) {
          const chunkId = item.attrs?.sourceChunkId
          if (typeof chunkId === 'string' && typeof item.attrs?.chunkText === 'string')
            evidence.set(chunkId, { id: chunkId, text: item.attrs.chunkText })
        }
        claims.push({
          claimId: id,
          blockId: id,
          text: claim,
          evidence: [...evidence.values()],
          fileNames: [
            ...new Set(cited.map((item) => item.attrs?.fileName).filter(Boolean) as string[]),
          ],
        })
      } else if (node.content?.some((child) => child.content)) walk(node.content, `${id}.`)
    })
  walk(content.content ?? [], '')
  return claims.slice(0, MAX_CLAIMS)
}

const fingerprint = (...parts: string[]) =>
  createHash('sha256').update(parts.join('|')).digest('hex')

export default class ClaimReviewService {
  constructor(private evaluator = new ClaimEvaluationService()) {}

  /**
   * Evaluate generated claims and record one non-blocking AI issue per unsupported one. Blocking
   * and override policy is still open (D-CLAIMS), so nothing here gates approval or export.
   * Returns the number of issues created.
   */
  async review(
    context: WorkspaceAccessContext,
    documentId: string,
    versionId: string,
    content: Node
  ) {
    const claims = extractClaims(content)
    const results = new Array<Awaited<ReturnType<ClaimEvaluationService['evaluate']>>>(
      claims.length
    )
    let next = 0
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, claims.length) }, async () => {
        while (next < claims.length) {
          const index = next++
          results[index] = await this.evaluator.evaluate(claims[index])
        }
      })
    )
    const issues: Array<{
      code: string
      title: string
      description: string
      fingerprint: string
      blockId: string | null
      claimHash: string | null
    }> = []
    let unchecked = 0
    claims.forEach((claim, index) => {
      const result = results[index]
      const sources = claim.fileNames.length ? ` Cited source: ${claim.fileNames.join(', ')}.` : ''
      if (result.status === 'unable_to_evaluate') unchecked++
      else if (
        result.status === 'missing_evidence' ||
        (result.status === 'evaluated' && !result.compliant)
      ) {
        issues.push({
          code: 'unsupported_claim',
          title: `Not supported by sources: ${excerpt(claim.text)}`,
          description: `The cited sources do not support this claim.${sources} Automated check; review the claim against the source.`,
          fingerprint: fingerprint('unsupported', result.claimHash, result.evidenceHash),
          blockId: claim.blockId,
          claimHash: result.claimHash,
        })
      }
    })
    if (unchecked)
      issues.push({
        code: 'claim_check_unavailable',
        title: `${unchecked} generated ${unchecked === 1 ? 'claim' : 'claims'} could not be checked`,
        description:
          'The automated claim check was unavailable. Review the cited sources manually.',
        fingerprint: fingerprint('unavailable', versionId),
        blockId: null,
        claimHash: null,
      })

    let created = 0
    for (const issue of issues) {
      const existing = await DocumentIssue.query()
        .where({
          workspaceId: context.workspaceId,
          documentId,
          issueFingerprint: issue.fingerprint,
        })
        .first()
      if (existing) continue
      await DocumentIssue.create({
        workspaceId: context.workspaceId,
        documentId,
        versionId,
        title: issue.title,
        description: issue.description,
        blocking: false,
        state: 'open',
        origin: 'ai',
        code: issue.code,
        blockId: issue.blockId,
        claimHash: issue.claimHash,
        issueFingerprint: issue.fingerprint,
        createdById: context.actorId,
        updatedById: context.actorId,
        revision: 0,
      })
      created++
    }
    return created
  }
}
