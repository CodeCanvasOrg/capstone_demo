# Document generation 409 investigation

Investigated and revised 2026-10-20. Scope: generation diagnosis and proposed fix only. DOCX extraction is already fixed and excluded from remaining work. No application code or task records changed during this investigation.

## Problem and current behavior

The reported task is `a856a209-f0de-45d3-b1aa-0d1fc2197afe`. Read-only queries against the configured development database found the historical failure below. A fresh query after the user's correction also confirmed that source preparation has since succeeded.

| Evidence | Result |
| --- | --- |
| Generation task | `conflict`, one attempt; completed its state transition at `2026-10-20T04:43:45.486Z`, matching the reported log |
| Document | `e439aad7-d803-4378-86a7-1daf5161923b`; generation failed, no current version; still points to this task |
| Pinned run | `d30a0d5f-9b89-4137-9ffe-d971a9ce5eb4`, already `failed` at `2026-10-20T04:37:55.688Z` |
| Historical source run | `Team_VoiceMind_AI_HLD_v2.docx`; the pinned failed run had zero extracted blocks |
| Latest source run, verified on revision | `392aeb91-dd8e-4c8b-bf35-afb78b1997a1`, `ready`, created at `2026-10-20T04:48:27.844Z` |
| Ingestion task | `10b10057-27d8-43ba-b7bd-94b25898bb40`, failed after three attempts |
| Input fingerprint, initial investigation | Document inputs at that check, using configured model/pipeline, matched the generation task's stored hash |
| Stored public error | `Inputs changed. Start a new request.` |

`GenerationService.request` selects the latest processing run without checking its status (`app/services/documents/generation_service.ts:59–88`). It therefore accepts a generation task pinned to a run that is already failed. During execution, the failed-source check throws `conflict('A selected source is unavailable')` at line 142, before retrieval or document generation is called at lines 156 and 164.

The failed-source check is the strongest explanation for this task. The database preserves no original exception or historical lease trace, so it cannot conclusively identify the branch taken at that instant. Current input identity matches, and the failed source predates this request, supporting this explanation over an actual changed-input event.

## Why the log and public message mislead

`OpenRouterService.status` reads `status` or `statusCode` from any object; it does not identify a provider exception (`app/services/open_router_service.ts:39`). The generation job's committed baseline labels that value `providerStatus`. Local workspace conflicts also carry status 409 (`app/services/workspaces/access_service.ts:19`). Thus the log does not establish an upstream 409.

`app/jobs/generate_document.ts:30` treats every 409 as stale, and `TaskService.fail` replaces all stale errors with `Inputs changed. Start a new request.` (`app/services/workspaces/task_service.ts:234`). This obscures failed sources and lease conflicts and would also misclassify a provider exception carrying 409.

The working tree already has uncommitted changes that log `err`, rename `providerStatus` to `errorStatus`, and log ingestion exceptions. The supplied log uses the earlier label. That establishes its logging format, but does not prove which code a current worker has loaded. Process inspection was denied by the environment.

## Completed prerequisite and remaining recovery

The DOCX fix and successful reprocessing are completed prerequisites. The latest source run is ready. Neither parser changes nor another preparation retry belongs in the revised plan.

The historical generation task still pins the older failed run and remains `conflict`; the document still points to it with generation status `failed` and no current version. A successful later preparation run does not rewrite immutable pins or revive a terminal generation task. A fresh generation request with a new mutation ID will select the latest ready run through the existing request path. Reusing the original mutation ID returns the original terminal task by design.

## Options and recommendation

1. **Fresh generation now, plus focused generation hardening — recommended.** Use the existing ready source through a fresh request. Reject known failed sources before creating future generation work and preserve distinct safe reasons for failures that arise later. Recovery does not depend on these code changes.
2. **Only request generation again.** Sufficient for immediate recovery with the latest ready source; incomplete as the durable fix because misleading error classification and acceptance of failed sources remain.
3. **Bypass readiness, silently omit the file, or repoint historical task pins.** Rejected: these break the selected-evidence and immutable-task guarantees.
4. **Reopen DOCX extraction, change provider/model settings, or add generic retries.** Outside the remaining problem: preparation is ready, and the logged status does not establish a provider failure.

No dependency or schema change is needed. Reuse the existing HTTP contract and checked-in Postman simulation. This revision used source review and read-only database queries; no provider request, recovery action, full test run, or live regeneration was performed.

## Open questions and limits

- Does a fresh generation request against the latest ready run succeed? This is the remaining runtime acceptance check; it has not been executed as part of planning.
- If fresh generation fails, use its original exception and failure stage to investigate retrieval/provider/content acceptance separately from the historical source failure.
- Current state cannot establish whether the historical task also encountered a lost lease or transient input mutation. Preserve those safeguards and improve their diagnostics.
