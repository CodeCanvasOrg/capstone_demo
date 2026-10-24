# UI simplicity verification

Date: 2026-10-24
Branch: `fix/ui-simple`
Worktree: `/private/tmp/capstone-ui-simple`

## Delivered behavior

- Persistent action errors and field errors replace duplicate or temporary failure feedback. Unknown backend/provider text is excluded from displayed messages.
- Failed requests preserve user input. Conflicting editor saves retain local content and JSON backup recovery. Upload failures retain individual files for explicit retry.
- One next workflow action is prominent. History, information editing, regeneration, preview, and deletion remain available through More. Approval acknowledgments and blockers remain visible.
- Sources, issues, properties, warnings, and optional form fields use named disclosures. A single inspector preserves drafts across mobile/desktop layouts and panel toggles.
- Copy and loading states are shorter across creation, files, workspaces, invitations, and authentication. Missing/server error pages provide a Home action.
- Buttons use explicit transition properties and reduced-motion-safe press feedback.

The initial UI passes left backend contracts, permissions, database schema, and dependencies unchanged. The membership-aware refinement below extends review/export behavior; schema and dependencies remain unchanged.

## Checks and outcomes

| Check | Result |
| --- | --- |
| `node ace codegen` (also run by the test command) | Pass |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `VITE_CACHE_DIR=/private/tmp/capstone-ui-vite-tests node ace test unit functional --no-clear` | 100 passed, 2 skipped |
| `npm test` | Unit/functional tests pass; command fails in browser suite setup before any browser scenario executes |
| `npm run build` | Pass |
| Prettier on changed TS/TSX implementation files | Pass; existing compact CSS formatting preserved |
| `git diff --check` | Pass |
| Vite resolved-config file-access check | Manrope font allowed; strict filesystem checking remains enabled; unrelated `/private/tmp` file rejected |

The two skipped tests depend on optional SMTP and Postman provider transports. Baseline unit/functional coverage was 94 passed and 2 skipped; six feedback tests were added.

## Worktree font fix

The worktree shares the original checkout's `node_modules` through a symlink. Vite resolves the font to that real dependency directory, which was outside its default worktree allow list. `vite.config.ts` now explicitly permits the workspace root and the resolved dependency directory using `realpathSync`. It does not disable strict filesystem checking or allow the original checkout as a whole. This follows [Vite's filesystem allow-list configuration](https://vite.dev/config/server-options.html#server-fs-allow).

## Browser verification limitations

Japa Chromium failed at startup with a macOS MachPortRendezvousServer bootstrap permission error (`Permission denied (1100)`). The app browser also rejected access to `http://127.0.0.1:3345` because origin approval was declined. No alternate browser route was attempted after that denial. The temporary agent-owned preview server was stopped.

Five browser scenarios are included in `tests/browser/ui_simplicity.spec.ts`, but remain unexecuted: metadata validation with optional-field reveal, issue draft preservation through resizing/panel toggling, conflicting saves with local backup, upload retry with safe errors, and responsive/theme/keyboard/reduced-motion behavior. Visual appearance, hydration, live console/network behavior, contrast, and screen-reader announcements are not confirmed by the passing static/unit/functional checks.

The worktree remains available for review; changes are not merged into `main`. Changes remain uncommitted because the filesystem sandbox rejected creating `.git/worktrees/capstone-ui-simple/index.lock` during staging. No Git metadata workaround was attempted.

## Icon and copy refinement

The follow-up pass uses Lucide icons before action labels, adds named icon buttons for Search, Save, Details, and More, and replaces pagination labels with named arrow controls. Icon buttons use the existing tooltip primitives, preserve refs/events for menus, and retain accessible names and visible focus. Primary workflow and destructive confirmation labels remain readable.

Repeated collection introductions, sidebar labels, empty-state prose, upload instructions, and checklist completion sentences were shortened. Inspector labels now use the standard `text-xs` scale instead of 10–11 px text. Blocker reasons, field labels, approval consequences, source limitations, upload size/type constraints, and local-draft recovery remain visible.

Follow-up checks: typecheck, lint, production build, and diff whitespace checks pass. The unit/functional suites again report 100 passed and 2 optional transport tests skipped. Existing browser scenarios were updated for the new accessible labels; browser/visual verification remains unexecuted under the restrictions above. The standalone codegen command generated its outputs successfully but kept its process open and was interrupted; the test command's codegen and test process completed successfully.


## Membership-aware checklist and PDF export

The user requested checklist subheadings only, optional review for solo workspaces, direct solo PDF export, and an always-visible checklist for teams. See [request and authorization contract](./solo-export-contract.md).

Delivered: checklist rows contain headings and status icons with assistive status names; percentage, progress bar and explanatory sentences are removed. The solo checklist is a closed disclosure. Team checklists remain expanded and visible in the mobile/desktop inspector, with no hide control. The primary solo action exports the saved draft. Workflow/document props refresh while the page is visible and on returning focus; existing dirty draft state is retained.

Server policy counts active memberships only. Exactly one active member can submit an optional review or export a meaningful saved draft without completing the checklist or creating an approval. Teams retain existing checklist/review/approval requirements. Solo tasks bind the saved version, writing inputs and source pins, and recheck membership before render, before publication and at download. Workspace-first locks serialize export authorization/publication with membership acceptance/revocation. Existing approved export identities remain supported.

Verification: 115 unit/functional tests passed, 2 optional transport tests skipped. Eight new local HTTP/service export tests cover solo incomplete checklists, optional solo review, team denial and approved success, pending/revoked membership counting, empty/stale versions and replay identity, membership change before rendering and downloading, membership change during rendering, and stale source/version snapshots. PDF and storage adapters are controlled test doubles; no production renderer/storage claim is made.

Final typecheck, frontend typecheck, production build, full lint, scoped lint and diff whitespace checks pass. Unrelated image/structured-output edits were preserved. A browser scenario for heading-only, always-visible team checklists was added but remains unexecuted under the recorded browser restrictions. Git metadata writes remain unavailable, so changes remain uncommitted in the worktree.
