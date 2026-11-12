import { createHash } from 'node:crypto'
import claimEvaluationConfig from '#config/claim_evaluation'

export const CLAIM_VERDICTS = ['supported', 'contradicted', 'insufficient_evidence'] as const
export type ClaimVerdict = (typeof CLAIM_VERDICTS)[number]

export type ClaimEvidence = { id: string; text: string }
export type ClaimInput = { claimId: string; text: string; evidence: ClaimEvidence[] }

type Hashes = { claimHash: string; evidenceHash: string }
export type ClaimEvaluation =
  | ({
      status: 'evaluated'
      verdict: ClaimVerdict
      probabilities: Record<string, number>
      confidence: number | null
      model: string
    } & Hashes & { claimId: string })
  // Deterministic application check: nothing to evaluate against, so the model is not asked.
  | ({ status: 'missing_evidence'; claimId: string } & Hashes)
  // Timeout, rate limit, missing credentials or malformed result. Never a semantic verdict.
  | ({ status: 'unable_to_evaluate'; reason: string; claimId: string } & Hashes)

type Fetch = typeof fetch

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function hashClaim(text: string) {
  return sha256(text)
}
export function hashEvidence(evidence: ClaimEvidence[]) {
  return sha256(JSON.stringify([...evidence].sort((a, b) => a.id.localeCompare(b.id))))
}

/**
 * Decision adapter for AI claim evaluation. Kept apart from OpenRouterService's text generation.
 * It only reports a typed verdict; it does not approve, rewrite or clear flags.
 */
export default class ClaimEvaluationService {
  constructor(
    private config = claimEvaluationConfig,
    private http: Fetch = (...args) => fetch(...args)
  ) {}

  async evaluate(input: ClaimInput): Promise<ClaimEvaluation> {
    const hashes = {
      claimId: input.claimId,
      claimHash: hashClaim(input.text),
      evidenceHash: hashEvidence(input.evidence),
    }
    if (!input.evidence.length) return { status: 'missing_evidence', ...hashes }
    const fail = (reason: string): ClaimEvaluation => ({
      status: 'unable_to_evaluate',
      reason,
      ...hashes,
    })

    let apiKey: string
    try {
      apiKey = this.config.apiKey.release()
    } catch {
      return fail('credentials_unavailable')
    }
    if (!apiKey) return fail('credentials_unavailable')

    let response: Response
    try {
      response = await this.http(this.config.endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.config.timeoutMs),
        body: JSON.stringify({
          model: this.config.model,
          state: { claim: input.text, evidence: input.evidence },
          questions: {
            verdict: {
              type: 'choice',
              instructions:
                'Judge the claim using only the supplied evidence. Preserve units, dates, scope and qualifiers such as "up to".',
              criteria: {
                supported: 'The evidence directly states or entails the whole claim.',
                contradicted: 'The evidence conflicts with the claim.',
                insufficient_evidence: 'The evidence neither supports nor contradicts the claim.',
              },
            },
          },
        }),
      })
    } catch (error) {
      const name = (error as { name?: string })?.name
      return fail(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network_error')
    }
    if (response.status === 429) return fail('rate_limited')
    if (!response.ok) return fail(`http_${response.status}`)

    let body: any
    try {
      body = await response.json()
    } catch {
      return fail('malformed_result')
    }
    const answer = body?.answers?.verdict
    if (
      answer?.type !== 'choice' ||
      !CLAIM_VERDICTS.includes(answer.choice) ||
      typeof body?.model !== 'string'
    )
      return fail('malformed_result')
    const probabilities: Record<string, number> = {}
    for (const [label, value] of Object.entries(answer.probabilities ?? {}))
      if (typeof value === 'number') probabilities[label] = value
    return {
      status: 'evaluated',
      verdict: answer.choice,
      probabilities,
      confidence: typeof answer.confidence === 'number' ? answer.confidence : null,
      // Record the resolved snapshot the provider actually used.
      model: body.model,
      ...hashes,
    }
  }

  /** A stored result may clear a flag only for the exact claim, evidence and pinned evaluator. */
  isCurrent(result: ClaimEvaluation, input: ClaimInput) {
    return (
      result.status === 'evaluated' &&
      result.claimHash === hashClaim(input.text) &&
      result.evidenceHash === hashEvidence(input.evidence) &&
      result.model.startsWith(this.config.model)
    )
  }
}
