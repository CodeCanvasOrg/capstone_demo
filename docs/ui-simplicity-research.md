# UI simplicity and feedback research

Date: 2026-10-24
Status: approved research; implementation completed on `fix/ui-simple`. See [verification](./ui-simplicity-verification.md) for evidence and remaining browser checks.

## Problem and current behaviour

Users need to write case studies, attach evidence, review their work, and export it without learning implementation details. The requested outcome is shorter text, fewer competing choices, and clear errors with a useful next step.

This audit inspected the current `main` checkout, not an older UI snapshot. No browser walkthrough or runtime error reproduction has been performed. The three existing `docs/worker-lifecycle-*` files are unrelated work and must be preserved.

| Before | After proposed | Why |
| --- | --- | --- |
| Two rows of document actions in `inertia/pages/documents/edit.tsx:228`, including history, information, generation, preview, and final export | Writing controls and the next permitted workflow action stay prominent; secondary actions move into a labelled menu | Reduce competing choices without removing capabilities |
| Always-expanded properties, checklist explanations, source controls, issues, and approval history in `inertia/components/documents/inspector.tsx:365` | Compact status and blockers first; Sources, Issues, and Details disclose the relevant controls | Show information when it helps a decision |
| Readiness percentage explanation and owner identifiers in `inertia/components/documents/inspector.tsx:425` and `:539` | Simple progress labels; approval records behind History; omit raw owner IDs | These details do not help someone finish a draft |
| A single action failure becomes a toast and a page alert in `inertia/pages/documents/edit.tsx:98` | One persistent error beside the affected action or form | Avoid duplicate announcements and make recovery discoverable |
| Metadata and issue forms use a shared action returning only a boolean (`inertia/components/documents/inspector.tsx:26`) | Structured client feedback maps validation errors to fields in the open dialog | A page-level error can be obscured by the dialog |
| Upload errors discard response details and show a generic toast in `inertia/components/files/form.tsx:93` | A per-file failure persists with a short reason and a Retry or Remove action | People should know which upload failed and retain the file for retry |
| `inertia/lib/api.ts:31` trusts the response error shape and treats every missing JSON success as a session error | Defensive response parsing; explicit network, validation, permission, session, conflict, and server states | An empty or malformed response does not prove the session expired |
| File processing errors and every warning render directly in `inertia/pages/files/edit.tsx:118` | A clear preparation status and recovery action; nonblocking warnings expand on request | Keep required actions visible without presenting internal errors |
| Error pages contain only a heading (`inertia/pages/errors/server_error.tsx:1`, `not_found.tsx:1`) | A short explanation and a safe route back | Dead ends make otherwise recoverable failures frustrating |
| Shared buttons use `transition-all` (`inertia/components/ui/button.tsx:7`) alongside an existing global press scale | Target only the required properties; retain subtle pointer press feedback | Follow Emil's interaction principles without adding decorative motion |

## Options considered

1. **Copy and styling only.** Smallest change, but leaves modal errors, duplicate feedback, and competing actions unresolved.
2. **Progressive disclosure plus consistent client feedback. Recommended.** Reuses existing components, preserves workflows, and directly addresses the request. Requires careful keyboard/focus and error-state verification.
3. **A new wizard or full visual redesign. Deferred.** Imposes a different navigation model, increases regression risk, and is unnecessary to improve these workflows.

## Recommendation

Keep the current visual identity and concentrate on the user's immediate task. Present one next workflow action, concise status, and relevant blockers. Use named disclosures such as Sources, Issues, Details, and History instead of a vague Advanced drawer containing everything.

Errors should say what failed and how to recover. Field errors belong at the field; action errors remain near the action; asynchronous failures remain visible until recovery or deliberate dismissal. Success may use a brief toast or save status. Do not announce the same failure twice.

Do not hide unsaved-change warnings, evidence limitations that affect review, approval acknowledgments, destructive consequences, or the way to recover a local draft. Do not automatically discard or reload unsaved text to recover from a conflict.

## Compatibility facts

The manifest declares React `^19.2.8`, Inertia React `^3.7.0`, Adonis Inertia `^5.0.1`, Radix UI `^1.6.7`, Sonner `^2.0.8`, Tailwind `^4.3.3`, and Framer Motion `^14.0.0`. Resolved versions verified during implementation: React 19.3.0, Inertia React 3.7.1, Adonis Inertia 5.0.1, Radix UI 1.6.7, Sonner 2.0.8, Tailwind 4.3.3, Framer Motion 14.0.0, and Vite 8.3.1. No dependencies were added.

Existing primitives include Collapsible, DropdownMenu, Alert, Dialog, Sheet, Tooltip, and Field. Existing editor conflict handling preserves local changes and permits a local JSON backup; retain that behaviour. Existing unsaved-change tracking and mutation IDs must survive disclosure and polling changes.

The UI skill's historical description of sharp corners and older fonts differs from current `inertia/css/app.css`, which uses Manrope and rounded components. Preserve the active stylesheet; this task does not change the brand.

## Risks and open questions

- Collapsing or moving forms must not unmount dirty editor state or create two instances on desktop/mobile.
- Error mapping must preserve known actionable business messages while excluding raw provider exceptions, stack traces, SQL, and internal identifiers. Unknown failures get a safe fallback.
- Permission and readiness remain server-owned. Hiding an action does not replace authorization.
- Failed polling must not generate repeated toasts or replace a still-valid document with a full-page error.
- No new API contract, schema, migration, or permissions are proposed. Any discovered backend defect requires separate scoping.
- Plan approval is required by `.agents/skills/feature-pipeline/SKILL.md`. Documentation is stored under `docs/` because `.agents/` is read-only in this session.
