# UI simplicity: component and feedback boundaries

Date: 2026-10-24
Status: implemented; companion to the approved implementation plan.

## Responsibilities

| Boundary | Responsibility |
| --- | --- |
| Existing backend and generated types | Authoritative validation, permissions, readiness, revisions, mutation identity, and task state |
| `inertia/lib/api.ts` | Browser CSRF adapter and frontend exports |
| `shared/ui_feedback.ts` | Defensive JSON transport, safe messages, typed errors and action results; independent of browser UI |
| `inertia/components/action_feedback.tsx` | Accessible persistent action/field messages and explicit recovery; no automatic retry |
| `inertia/components/icon_button.tsx` | Lucide utility button with an accessible name and existing Radix tooltip; forwards native button props and refs |
| Originating form | Field validation, input preservation, submit progress, and first-invalid-field focus |
| Document edit page | Toolbar hierarchy, next permitted workflow action, export status, and page-level operation state |
| Document inspector | Named disclosures, visible blockers/counts, source selection and issue forms |
| Document editor | Editor content, autosave, version conflicts, local backup and explicit recovery |
| Upload form | Per-file queued/uploading/failed/succeeded state and retry/removal |
| Shared layout | Existing flash feedback; avoid duplicating feedback already handled locally |

Reuse existing Radix DropdownMenu/Dialog and semantic tokens. `Disclosure` uses native details to keep its children mounted. The single inspector changes visibility/layout on mobile instead of mounting a second copy in a sheet. A component is extracted only when multiple call sites justify it; no generic form framework or new global state system.

## Feedback flow

1. An operation starts in its owning form or action; disable duplicate submission and clear only that operation's stale feedback.
2. Read the existing response/status defensively. Known validation errors retain field paths. Known workflow failures retain a safe explanation. Unknown messages become a contextual fallback.
3. Validation errors render at their fields, expanding optional sections containing errors. Non-field errors render inside that form or beside that action.
4. Recovery is explicit. Network/server/rate-limit failures can offer retry when safe; permission errors explain access; session failures offer sign-in without discarding unsaved text; conflicts offer local preservation and latest-state recovery.
5. Successful recovery clears the corresponding error. Polling does not repeatedly announce an unchanged failure. Unmounted views ignore stale results.

Do not reclassify malformed successful responses as authentication failures. Do not put raw server messages, stack traces, provider payloads, owner IDs, or storage identifiers in an expandable technical-details section.

## State lifetime and disclosure

Disclosure state belongs near the presentation component. Draft data, source selection, issue drafts, and mutation references remain in their existing state owners and survive closing a section. Use a single active inspector; avoid mounting separate editable desktop and mobile copies.

Counts, status, unsaved state, blocking errors, and review-relevant warnings remain visible outside collapsed content. Optional properties and historical records may be hidden until requested. Opening a section never triggers a save or changes server state.

Existing workspace dirty tracking continues to guard navigation. Existing partial reloads/polling must not remount the editor or reset open forms. No new animation is required for repeated actions; optional disclosures can be immediate. Keep existing reduced-motion support.

## Dependencies and failure path

The client depends on the response envelope and generated data, not backend models/services. The membership-aware export refinement below adds server-derived workflow fields and export policy without a database migration.

Each phase is separately verifiable and reversible. Reverting the presentation phase restores the old layout without data migration. A feedback failure must preserve user input and show a generic contextual recovery message; it must not silently consume an exception or replace the draft. Existing backend logging remains authoritative; secrets and raw responses are never logged by new UI code.


## Membership-aware export refinement

`ReadinessService` now derives `reviewRequired` from the active membership count and exposes `canExport`. `WorkflowService` preserves team prerequisites and permits optional solo review on meaningful saved content. `DocumentExportService` accepts either the existing approval identity or an exact solo base version. Solo export snapshots have an explicit mode, version, input hash and source pins; they never create artificial approval records.

Request, publication and download serialize with membership changes on the workspace row before membership/document locks. `TaskService.finish` has an opt-in workspace lock used by PDF publication. Render and download revalidate both membership mode and the exact snapshot. Team and legacy approved exports retain approval validation. No migration, new route or dependency is required.
