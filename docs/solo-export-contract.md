# Membership-aware PDF export

Date: 2026-10-24

The existing route `POST /workspaces/:workspaceId/documents/:documentId/exports/pdf` accepts `mutationId` (required UUID), `approvalId` (optional UUID), and `baseVersionId` (optional UUID). Its 202 task response is unchanged.

- Exactly one active workspace membership: send the current saved `baseVersionId` to export directly. A meaningful saved draft is required and active generation must finish. Checklist completion, review submission and approval are optional.
- More than one active membership: send the current `approvalId`; the existing checklist, exact-version review, owner approval and evidence acknowledgments apply. An omitted or stale approval returns 409.
- Pending invitations and revoked memberships do not count. Zero active memberships cannot authorize an export.
- A missing or stale solo version, membership change to team mode, or changed export snapshot returns 409. Solo exports never fabricate approval records or label a draft as approved.
- Existing authenticated workspace access, private storage, task leases, mutation identity, evidence hydration, and scoped downloads remain enforced. Solo membership and snapshot checks run again at rendering, publication, and download; approved exports retain existing approval checks.

Editor workflow readiness adds `reviewRequired` and `canExport`. Checklist rows keep their names/statuses but omit visible reasons and progress text. Team checklists stay expanded and visible even at mobile widths; solo checklists are optional disclosures.

Verification lives in the Japa functional export/workflow tests. Those tests exercise local HTTP authorization and controlled rendering/storage; they do not establish production provider or browser behavior.

Policy status: this solo draft-export behavior conflicts with the Approved-only wording of FR-EXP-08 and is tracked as proposed decision D-SOLO in the [decision register](decision-register.md). The behavior above stays current until a decision is accepted.
