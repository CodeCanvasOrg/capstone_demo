# HumbleBeeAI interface redesign plan

Date: 15 October 2026

Status: Review specification. No application components, packages, routes, or styles have been changed.

Read with [workspace tenancy architecture](workspace-tenancy-architecture.md) and [backend implementation steps](workspace-tenancy-implementation-plan.md). The backend endpoint and authorization contracts in those documents govern this interface.

## 1. Sources, authority, and current defects

| Label            | Meaning                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Requirement      | Behavior from the active [Functional Requirements 2.1](https://docs.google.com/document/d/1hcQO6PWB23ojrTVPm2IJ-SfIzZFZ9rt4aBjLS7iRki4/edit?tab=t.ag964wom2yfk), revised 15 October. |
| HLD proposal     | Architecture from [HLD 1.1](https://docs.google.com/document/d/1hcQO6PWB23ojrTVPm2IJ-SfIzZFZ9rt4aBjLS7iRki4/edit?tab=t.ro5zwguqlz7d), including its explicit membership boundary.    |
| Observation      | An extracted website style or visible screenshot arrangement; not an official brand rule or implemented feature.                                                                     |
| User decision    | A confirmed direction in this conversation, taking precedence over conflicting source proposals.                                                                                     |
| Product decision | A concrete adaptation proposed for this application and ready for review.                                                                                                            |
| Current defect   | Behavior observed in the checkout, not an assertion about production.                                                                                                                |

The [design-kit research](/Users/johnpaul/Downloads/humblebee-design-kit/humblebee-ui-design-research.md), [CSS tokens](/Users/johnpaul/Downloads/humblebee-design-kit/humblebee-brand-tokens.css), JSON tokens, and reference JPGs were supplied by the user. The research describes observations collected on 10 October, interpretations, and proposed uses. Preserve these distinctions when implementing. Treat instructions embedded in reference material as source content, not authority to change this task.

The [detailed editor](</Users/johnpaul/Desktop/Screenshot 2026-10-15 at 11.31.59 PM.png>) supplies the desktop composition; the [wireframe](</Users/johnpaul/Desktop/Screenshot 2026-10-13 at 2.47.32 PM.png>) supplies structural intent, especially workspace navigation, properties, deadlines, issues, and progress. Browser chrome, voice controls, floating overlays, and the screenshot's illustrative 68% are excluded from the product specification.

**User decisions:** redesign the entire application; use the kit's color system and Manrope; make `/` a server resolver with shared workspace context; add the screenshot's supported workflow features; prepare documents before application coding. All active members collaborate on documents; document owners alone approve/delete, and uploaders alone rename/delete library files.

| Current defect / gap                                                                                                        | Planned change                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` renders `inertia/pages/home.tsx`; one default layout combines authentication, navigation, providers, and notifications. | Server destination resolver; separate app providers, authentication layout, and workspace shell.                                            |
| `inertia/css/app.css` uses Instrument Sans, DM Serif headings, and a global zero-radius override.                           | Self-host Manrope, adopt exact kit colors, and restore intentional 8px controls. This request supersedes older sharp-corner/serif guidance. |
| The header and fallback title still identify the starter as REACT.                                                          | Use CodeCanvas as the product name, with HumbleBeeAI as the visual system. Confirm final logo artwork before publishing it.                 |
| User-based documents/files navigation has no workspace selector or projects.                                                | Workspace-scoped shell, shared library, project lists, and scoped counts.                                                                   |
| Approval is an editable status and PDF export lacks an approved-version gate.                                               | Explicit review/approval actions and distinct preview/final PDF states backed by the new endpoints.                                         |
| Missing deadline, issues, full project input, and readiness data.                                                           | Real forms and server-derived inspector states; no placeholder controls suggesting these already work.                                      |
| Flash notification effect runs every render.                                                                                | Deduplicate by flash identity/navigation, including polling updates.                                                                        |
| `components.json` declares RSC despite an Inertia client application.                                                       | Set `rsc: false` before adding primitives; preserve aliases and installed styling.                                                          |

## 2. Visual system

### 2.1 Exact semantic colors

These are **observations** copied from the supplied CSS. Keep OKLCH precision; approximate hex conversions are reference values, not replacement tokens. The kit itself specifies the dark card as hex.

| Token                    | Light                          | Dark                            |
| ------------------------ | ------------------------------ | ------------------------------- |
| `background`             | `oklch(93.4% 0 0)`             | `oklch(15.434% .00002 271.152)` |
| `foreground`             | `oklch(0% 0 0)`                | `oklch(98.5% 0 0)`              |
| `subtitle`               | `oklch(37.1% 0 0)`             | `oklch(90% 0 0)`                |
| `card`                   | `oklch(91.279% .0001 271.152)` | `#1d1d1f`                       |
| `card-foreground`        | `oklch(0% 0 0)`                | `oklch(98.5% 0 0)`              |
| `popover`                | `oklch(100% 0 0)`              | `oklch(20.5% 0 0)`              |
| `popover-foreground`     | `oklch(14.5% 0 0)`             | `oklch(98.5% 0 0)`              |
| `primary`                | `oklch(87.3% .196 98.5)`       | Same                            |
| `primary-foreground`     | `oklch(6.7% 0 0)`              | Same                            |
| `highlight`              | `oklch(82.9% .171 80.99)`      | Same                            |
| `secondary`              | `oklch(96% 0 0)`               | `oklch(28% 0 0)`                |
| `secondary-foreground`   | `oklch(15% 0 0)`               | `oklch(98.5% 0 0)`              |
| `muted`                  | `oklch(96% 0 0)`               | `oklch(26.9% 0 0)`              |
| `muted-foreground`       | `oklch(50% 0 0)`               | `oklch(70.8% 0 0)`              |
| `accent`                 | `oklch(96% 0 0)`               | `oklch(25% 0 0)`                |
| `accent-foreground`      | `oklch(20% 0 0)`               | `oklch(98.5% 0 0)`              |
| `destructive`            | `oklch(60% .2 27)`             | `oklch(42.8% .153 29.2)`        |
| `destructive-foreground` | `oklch(98% 0 0)`               | `oklch(94.5% 0 0)`              |
| `border`                 | `oklch(90% 0 0)`               | `oklch(100% 0 0/.1)`            |
| `input`                  | `oklch(90% 0 0)`               | `oklch(100% 0 0/.15)`           |
| `ring`                   | `oklch(88.8% .207 104.3)`      | Same                            |

Map these into the existing Tailwind v4 CSS variable system. Do not replace the project stylesheet with a second generated theme or retain obsolete serif/zero-radius overrides later in the cascade. Keep light/dark tokens together, with theme-aware semantic classes in components.

**Product adaptations, explicitly separate from extraction:**

- Sidebar surfaces use the extracted neutral `sidebar` values: light `oklch(98.5% 0 0)`, dark `oklch(20.5% 0 0)`. Use kit foregrounds, neutral selected-row fills, and a yellow current-workspace marker. Set sidebar primary/foreground to the yellow/near-black primary pair in both themes; discard the extracted incidental dark blue sidebar default.
- A `document-surface` token uses the light popover white and dark card surface. The surrounding editor uses background. This gives the screenshot's paper/canvas distinction without hardcoded white across themes.
- Primary actions are yellow pills with dark text; aim for one dominant action per task surface. Secondary actions use neutral controls. Statuses combine labels/icons with color and are not all yellow.
- Use foreground text plus underline for links on light surfaces. The kit's yellow-on-light pairing has inadequate text contrast. Strengthen interactive boundaries and focus indicators through separate accessibility tokens where measurements require it; do not claim unchanged kit borders meet every contrast requirement.
- Focus uses a clearly visible dark/light outline appropriate to the surface plus yellow accent. Validate text at 4.5:1, large text at 3:1, and essential UI boundaries/focus at 3:1. Destructive controls also need measured text contrast; dark foreground on a suitable fill or a neutral button with destructive icon/label is preferable to an unverified white-on-red pairing.
- Omit marketing glow/shadows on ordinary controls. Use borders, spacing, and a restrained popover elevation only where needed to distinguish layers. Do not import the chart palette until a real chart requires it; workflow progress is a checklist.

### 2.2 Typography, spacing, and assets

**Observation:** Manrope variable 200–800, 16px/24px body, compact metadata, simple geometric controls, generous document whitespace, a 90rem website container, and a roughly 672px article reading width.

**Product decisions:**

| Use                      | Specification                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Font                     | Self-host `@fontsource-variable/manrope`; `font-display: swap`, then system sans fallbacks. Keep heading/body in the same family. |
| App heading              | 28–36px, weight 600, close tracking; avoid oversized marketing typography inside tools.                                           |
| Panel heading            | 20–24px, weight 600.                                                                                                              |
| Body and editor          | 16px/24px minimum reading default; comfortable paragraph spacing.                                                                 |
| Controls / metadata      | 14px/20px controls; 12px/16px metadata with adequate contrast.                                                                    |
| Document title           | Responsive 30–48px, weight 600; wrap long titles without shrinking the whole document.                                            |
| Eyebrow / section number | Small uppercase or tabular numbering; monospace only for these labels and technical identifiers.                                  |
| Spacing                  | 4px scale; common 8/12/16/24/32/48px gaps.                                                                                        |
| Geometry                 | 8px controls, 12px media, 16px grouped cards/dialogs; pill primary CTA. Remove the blanket `border-radius: 0`.                    |
| Content width            | General screens up to 90rem when useful; editor reading area 640–720px at desktop, fluid on smaller screens.                      |
| Icons                    | Existing Lucide icons, consistent stroke and size, text labels or accessible names.                                               |

The kit's asset manifest describes original paths; it does not supply those assets to this repository. Use the textual CodeCanvas wordmark until approved logo SVG/artwork is supplied. Do not trace a logo from the screenshot. Decorative illustration is optional on authentication/empty surfaces and must not compete with editing or invent a new mascot. The brand's human-direction philosophy appears through editable output, inspectable sources, explicit AI acceptance, and deliberate owner approval.

## 3. Routes, providers, and state ownership

### 3.1 Server entry and layouts

`GET /` authenticates and resolves the remembered authorized workspace, then initial workspace, then another active membership. Guests reach login; a user with no active workspace reaches recovery. No root marketing page or client `useEffect` redirect remains. Invitation destinations survive login using allowlisted internal destinations.

Canonical application paths start with `/workspaces/:workspaceId`. Workspace selection POST authorizes and remembers the selection before redirecting home. Remembered preference never overrides the URL's workspace authorization. Use Tuyau/generated route types rather than hand-built tenant URLs.

```text
inertia/app.tsx                       inertia/ssr.tsx (same composition)
  TuyauProvider (existing client)
    AppProviders
      MotionConfig reducedMotion="user"
        ThemeProvider
          TooltipProvider
            Inertia App
              AuthLayout             login / signup
              PublicLayout           invitation landing / safe errors
              WorkspaceLayout        authenticated workspace pages
                WorkspaceProvider    server-derived props
                  SidebarProvider    responsive navigation state
                    WorkspaceShell
                      Page / Editor
            FlashNotifications + Toaster
```

This diagram describes ownership, not a requirement to duplicate provider instances per page. Preserve providers across Inertia visits with persistent layout composition. Share one layout resolver between client and SSR entries. Keep SSR disabled in configuration; mirroring the entry prevents divergence without enabling server rendering. Browser-only storage/media effects remain guarded.

`AppProviders` owns theme, motion, tooltip configuration and notifications. `WorkspaceProvider` exposes current workspace, active summaries, membership, and server capabilities. It does not fetch an unrestricted workspace directory or authorize anything. Auth/invitation/error props allow null workspace/user and must render safely. Layouts own landmarks and the skip link; pages must not nest duplicate `main` elements.

### 3.2 Switching, cache, and unsaved work

- Keep the theme and app providers mounted. Reset document drafts, tenant search results, selection, inspector data and polling using workspace/resource identities after a successful switch; no previous workspace content flashes while loading.
- Do not key the entire editor by changing poll props or task status. A same-document refresh must preserve selection, scroll and unsaved text. Reconcile accepted version identity explicitly.
- Intercept workspace/navigation changes when local edits are unsaved. Offer Save and switch, Discard and switch, or Stay. Save waits for success; a 409 keeps the user in the editor. Add the browser unload warning only while necessary.
- Remembering a workspace is a server-side navigation preference. Do not use local storage as an authorization cache. When access is revoked, stop requests, clear private tenant state, and show a recovery destination using safe server props.
- Retain existing Tuyau integration, Radix citation focus behavior, and Inertia polling's state preservation. Tenant URL changes and stale responses must be checked before applying any result.
- Deduplicate flash notifications with stable identity/dependencies. Polling must not repeat success toasts or dismiss unrelated action feedback. Persistent failures appear inline as well as in optional toast feedback.

## 4. Complete screen specification

`W` below means `/workspaces/:workspaceId`. Capabilities determine presented actions; the server independently enforces them. Every list includes initial loading, empty, filtered-empty, error/retry, and pagination states with accurate scoped counts.

| Screen / route                                 | Content and main actions                                                                                              | States and permission details                                                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login `/login`                                 | Quiet brand panel, email/password, sign-in action, signup link, theme control.                                        | Inline field errors, submitting, incorrect credentials, expired session, safe intended destination. Do not add unimplemented OAuth buttons.                                         |
| Registration `/signup`                         | Name/email/password and existing account link. Explain initial workspace creation in plain product language.          | Duplicate/invalid email, pending submit; success only after atomic account/workspace creation. Actual route name follows existing signup routes.                                    |
| Invitation `/invitations/:token`               | Inviting workspace, addressed identity, sign in/register, explicit Accept invitation.                                 | Matching account, wrong account with switch option, expired/revoked, already accepted, pending acceptance. GET never joins; avoid rendering secret token in diagnostics.            |
| Workspace chooser `/workspaces`                | Authorized workspace cards, current membership, Create workspace dialog.                                              | Zero-membership recovery; no arbitrary workspace lookup.                                                                                                                            |
| Workspace home `W`                             | Workspace name, recent case studies, projects, useful counts and New case study CTA.                                  | Fresh workspace onboarding, no recent items, retry; no fabricated analytics or deadlines.                                                                                           |
| Workspace switcher                             | Search own memberships, name/role, current check, Create workspace.                                                   | Keyboard command-style selection; unsaved-edit guard; loading/error restores old selection.                                                                                         |
| Workspace settings                             | Rename form in a dialog/panel opened from home.                                                                       | Workspace owner only; no workspace delete/ownership-transfer UI. Member view explains management boundary.                                                                          |
| Members `W/members`                            | Active members and attribution, invitations with delivery/expiry labels.                                              | Owner invite/resend/revoke/remove; others read-only. Owner cannot remove self. Removing an author explains the remaining owner-only action limitation.                              |
| Projects `W/projects`, `W/projects/:projectId` | Searchable project list, create/edit dialogs, project's case studies, New case study.                                 | Active members may manage project metadata. Ungrouped filter remains available; no project deletion action in v1.                                                                   |
| Case studies `W/documents`                     | Search, project/status filters, title, owner, workflow, deadline, updated time.                                       | Search state scoped in URL, debounced and cancellable; no user-only default filter. Clear filters and create actions in distinct empty states.                                      |
| Files library `W/files`                        | Searchable shared rows with type/size/uploader/status, upload CTA.                                                    | Members browse/download/attach. Rename/delete only for uploading owner; unavailable bytes/processing failure explicit.                                                              |
| Upload `W/files/create`                        | Accessible dropzone and native file input, allowed types/limits, per-file validation and processing state.            | Actual upload progress only if measured; ingestion queued/running/failed/ready separately. Retry authorized failed work; no claim that transfer completion means evidence is ready. |
| File details `W/files/:fileId/edit`            | Filename, uploader, revision, processing details, preview/download, same-workspace document links.                    | Owner rename/delete confirmation lists affected evidence; detachment belongs to the document, not library deletion. Safe error instead of raw model output.                         |
| Case-study input `W/documents/create`          | Title, optional project/deadline, seven project-information fields, shared file picker or explicit input-only choice. | Save Draft and deliberate Generate action. Preserve incomplete draft input; generation/review prerequisites explained from server reasons.                                          |
| Editor `W/documents/:documentId/edit`          | Three-column workspace/editor/inspector shell described below.                                                        | Shared edit, save conflict, generation, unavailable evidence, review and owner-only actions are explicit.                                                                           |
| Evidence inspection                            | Citation popover plus inspector/sheet with file, revision, page/section, excerpt/image, source link.                  | Loading, missing source, denied access, no extraction; no raw object URL/key. Citation is evidence provenance, not an automatic truth guarantee.                                    |
| Issues                                         | Inspector list and create/edit dialog: title, description, blocking, open/resolved, actor/time.                       | Any member may create/update/resolve/reopen; no delete action. Open blocking issues prevent review/approval/export.                                                                 |
| Review                                         | Readiness reasons, exact saved version, source/warning summary and Submit for review.                                 | Members submit; owner sees Approve reviewed version with required warning acknowledgments. Stale review returns conflict and refresh prompt.                                        |
| PDF preview / export                           | Clearly labeled draft preview; final PDF action only for valid approved current version.                              | Queue/render/retry/download states. Download rechecks approval; edited or blocked content cannot keep a stale final link. Do not advertise unsupported formats.                     |

Authenticated invitation/recovery screens may use app providers without a workspace shell. Existing error pages need the same typography/theme and a safe destination. Workspace revocation is not a generic full-page crash.

## 5. Editor composition and interactions

### 5.1 Responsive structure

**Desktop, 1280px and above:** use a 240–256px left navigation, flexible central workspace (`min-width: 0`), and 288–320px inspector. At tighter widths choose the lower bounds so the document still has useful space. The central paper can be up to 48rem including about 48px horizontal padding on each side, giving roughly 672px reading width. Center it with a modest top margin on the neutral canvas; scale padding down before compressing text.

Left navigation includes CodeCanvas, workspace selector, Home, Projects, All case studies, Files, recent documents and bottom account/theme controls. Selected navigation is neutral with a clear marker; the current item stays distinct from hover. Recent items link to canonical workspace URLs. The polished screenshot's evidence selection lives in the right inspector, while Files remains a shared-library destination on the left.

The top header spans the editor area: project breadcrumb, document name, workflow badge, actual save status, preview/export menu and current primary action. Under it, a compact formatting toolbar retains editor selection on click and exposes accessible pressed states. Right inspector groups properties, deadline/owner/version, workflow readiness, issues, and selected evidence. Each section can collapse without losing its state.

**Tablet, 768–1279px:** keep a slim navigation rail at 1024px and above where space permits; otherwise use a navigation sheet. Move the inspector into a labeled right sheet. Keep document text at its normal reading size and center it; do not shrink the entire desktop composition. Properties/evidence buttons remain reachable in the header.

**Mobile, below 768px:** navigation and inspector are modal accessible sheets with headings and close buttons. Only one modal surface opens at a time. Use a compact header and scrollable/grouped formatting toolbar; do not overflow the page horizontally. The document becomes fluid with 16–24px padding. Tables/code blocks scroll inside their own container. Focus returns to the opener after closing a sheet.

Use `100dvh` for the shell with a sticky title/toolbar and explicit central document scroll. Long navigation and inspector content may scroll independently, but avoid nested document scroll traps. At zoom or very short viewport heights, allow natural layout scrolling where necessary so dialogs/actions remain reachable.

### 5.2 Editing and generation

Show distinct states: Unsaved changes, Saving, Saved with time, Save failed, Conflict, and Offline where detected. Never display Saved based only on a keystroke debounce. Saves include the base version and mutation identity; a stale base preserves local content and offers comparison/reload or explicit copy recovery. Do not overwrite the editor with a polling response.

Generation displays queued/running state and safe step messages; no invented processing percentage. Disable duplicate requests while the same operation is pending. Initial generation may create a saved Draft according to the backend contract. AI edit proposals require an explicit acceptance action once the corresponding candidate/acceptance endpoint exists; polling and autosave never accept them. Retain local edits during errors and revoke/cancel stale results after source/input/version changes.

Input fields use the shared FR-ING-01 shape: overview, problem statement, work completed, technical approach, tools/models/technologies, challenges, and results. Label required information and show specific validation reasons. The source mode is either selected ready files or recorded input-only work with no selected files; clearing a file picker alone does not silently assert input-only readiness.

Source rows identify library file, pinned revision, selection and processing state. Selection is server-persisted and shared between input form and inspector; do not maintain two competing local source lists. Detach wording explains that it stops future retrieval while historical citations retain their provenance. File deletion separately explains unavailable evidence.

Citation popovers preserve TipTap selection and the existing focus safeguard; don't auto-focus a source interaction back into the editor unexpectedly. Use registered protected asset routes for images/previews, accessible alternative text, and sanitized rich content. Reopening a citation restores meaningful focus. Distinguish extracted evidence, user-authored text and unresolved source warnings through labels rather than decorative scores.

### 5.3 Deadline, issues, and workflow readiness

The optional deadline is a calendar date with clear Add/Edit/Remove actions. Keep it as `YYYY-MM-DD`, not a timezone-shifted midnight timestamp. Show Overdue for past dates while not approved. Deadline changes use metadata concurrency but do not invalidate approval.

Issues display open/resolved and blocking flags, creator/updater/resolver and timestamps. Adding/reopening an open blocking issue invalidates review/approval on the server and the UI updates the primary action accordingly. Nonblocking issues remain visible during owner sign-off. Do not add a separate kanban product to this scope.

Use **Workflow readiness**, not completion confidence. Server results supply reasons and four equal stages:

| Stage                    | Completion criterion                                                                                                                  | Contribution |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Project information      | All seven required fields are valid and nonempty.                                                                                     | 25%          |
| Source preparation       | At least one selected file and every selected source has an eligible ready pin, or explicitly recorded input-only mode with no files. | 25%          |
| Editorial readiness      | Saved valid nonempty current version, no open blocker/conflicting generation, and an active review for that version.                  | 25%          |
| Current-version approval | Valid owner approval of the unchanged current review/version.                                                                         | 25%          |

Each row exposes complete/incomplete and reasons; the total is 0/25/50/75/100%. It may decrease after edits. Keep ingestion and generation activity separate. Use text and icons with the progress bar, including an accessible value label. The UI never computes a competing heuristic or displays the screenshot's example 68%.

### 5.4 Review and PDF

Remove the arbitrary lifecycle select. The main action moves from Save/Generate to Submit for review, then owner-only Approve reviewed version, then Export approved PDF. Always retain ordinary editing actions; accepted edits invalidate the active review/approval and transition back to Edited. Do not infer approval from a badge, a successful render, or workspace-owner role.

Approval confirmation identifies exact version, reviewer/owner, blocking criteria and evidence warnings requiring acknowledgment. Show server rejection reasons inline, including stale review and another member's accepted edit. Historical approvals remain inspectable as audit history, without presenting them as current approval.

Preview is labeled Unapproved preview and has a separate route/artifact identity. Final export identifies the approved version and handles queued/rendering/failed/ready states. Recheck authorization/approval at download; remove stale final links on invalidation. PDF layout is independent of app theme: a consistent light print surface, embedded Manrope if supported by the renderer, sensible headings/page breaks, source citations, margins, and no app chrome. Verify long text, tables, images, and unavailable evidence in an actual rendered PDF during implementation.

## 6. Components and CLI sequence

### 6.1 Reuse before adding

Keep the current Button (including exported `ButtonProps`), Input, Textarea, Select, Label, Badge, Card, Table, Tabs, Dialog, AlertDialog, DropdownMenu, Tooltip, Popover, Separator, Skeleton and Sonner. Preserve local underscore import paths such as `dropdown_menu.tsx` and `alert_dialog.tsx`; don't introduce duplicate primitives to accommodate registry naming. Keep existing theme and editor/citation functionality while moving their composition.

Add Sidebar for shell structure, Breadcrumb for hierarchy, Avatar for members, Command for workspace/file selection, Sheet for responsive panels, ScrollArea only where it improves a real scroll surface, Progress/Collapsible for readiness, Checkbox for source/warning selection, Alert for persistent failure, Empty for empty states, and Field for accessible form structure. Use native date input initially unless a full calendar interaction is justified; no extra date-picker dependency is required.

The installed local shadcn CLI is 4.21.0. Its [official CLI documentation](https://ui.shadcn.com/docs/cli) describes `--dry-run` and `--diff`. The [Sidebar documentation](https://ui.shadcn.com/docs/components/radix/sidebar) explains its provider and responsive composition. Preview output in this checkout already identified primitive replacement risks; generator output is not automatically safe to accept.

### 6.2 Future commands, after approval

Run these in the dedicated implementation worktree described in the backend plan. They are instructions, not commands executed for this documentation delivery.

```bash
bun add @fontsource-variable/manrope

npx --no-install shadcn add \
  sidebar breadcrumb avatar command sheet scroll-area \
  progress collapsible checkbox alert empty field --dry-run

npx --no-install shadcn add sidebar --diff
```

Before actual generation, set `components.json` to `rsc: false`, retain aliases, and confirm its Tailwind v4 configuration matches the actual project files. Do not run `shadcn init` over the current setup.

Observed previews: the shell component batch introduced ten files and proposed replacing seven existing primitives; checkbox/alert/empty/field introduced four files and proposed replacing two. Dependencies include `cmdk` and registry helpers; sidebar also introduces `use-mobile` and input-group files. Preview each actual command again because registry contents may change. The sidebar diff removed the local `ButtonProps` export; existing imports rely on it. Reconcile dependency changes into the single Bun lockfile.

After reviewing diffs, install selected groups interactively:

```bash
npx --no-install shadcn add sidebar breadcrumb avatar command sheet scroll-area
npx --no-install shadcn add progress collapsible checkbox alert empty field
```

Skip replacement of existing files at prompts, then merge only required compatible changes deliberately. Do not use blanket `--overwrite` or `--yes` to accept replacements. Review button, separator, tooltip, input, skeleton, textarea, dialog and label changes, including exports, accessibility, aliases and radius variants. New primitives must use the same semantic token system and current React/Inertia conventions.

Use installed Ace generators for new Inertia pages and browser tests. Existing auth/documents/files pages are edited in place, not regenerated. Workspace creation/settings and project creation/editing use dialogs on these pages, matching the endpoint matrix rather than inventing additional GET routes.

```bash
node ace make:page workspaces/index --react
node ace make:page workspaces/home --react
node ace make:page workspaces/members --react
node ace make:page projects/index --react
node ace make:page projects/show --react
node ace make:page invitations/show --react
node ace make:page errors/workspace_unavailable --react

node ace make:test workspace_shell --suite=browser
node ace make:test workspace_editor --suite=browser
node ace make:test workspace_invitations --suite=browser
node ace make:test workspace_review_export --suite=browser
```

Ordinary React components/layouts have no required Ace generator. Proposed modules: `inertia/providers/app_providers.tsx`, `workspace_provider.tsx`, `layouts/auth.tsx`, `layouts/public.tsx`, `layouts/workspace.tsx`, and grouped workspace/editor components. Prefer small modules for workspace switcher, navigation, document header, toolbar, properties, readiness, issue list, source picker and review controls; avoid a single page owning every mutation. Share presentational components and typed query/form contracts, not global mutable workspace services.

Delete or retire the old home page only after the root route stops resolving it and callers use the destination resolver. Retire document-share navigation when authorization cutover occurs. Change fallback app title and starter SVG/ARIA labels together; keep accessible route names and branding consistent.

## 7. Motion and accessibility behavior

Apply the invoked Apple-design principles as product behavior: immediate feedback, continuity, interruptibility, and predictable focus. Do not port long marketing animations into editing tools.

| Interaction                        | Product motion / accessibility                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Button press                       | Immediate pressed fill/opacity; roughly 100ms feedback, no layout shift or toolbar scaling.                                             |
| Hover / selection                  | 150–180ms color transition; current selection remains recognizable under hover.                                                         |
| Inspector / sheet                  | 200–300ms restrained translation/opacity or low-bounce spring; enter/exit follow the same path and can reverse promptly.                |
| Collapsible sections               | Short height/opacity transition; content remains correctly hidden from focus when collapsed.                                            |
| Save / processing feedback         | Stable inline status with polite live announcements; no flashing or repeated toast loop.                                                |
| Workspace navigation               | Clear loading state; no staged page reveal that delays useful input.                                                                    |
| Reduced motion                     | Honor `prefers-reduced-motion` through MotionConfig and CSS; remove spatial/spring animation, using immediate or brief opacity changes. |
| Reduced transparency               | Honor `prefers-reduced-transparency` with solid sheet/popover surfaces; default surfaces already readable without blur.                 |
| Increased contrast / forced colors | Strengthen borders and labels, preserve system outlines/controls, avoid conveying status through fill alone.                            |

Use semantic buttons/links, associated field labels, descriptive validation, accessible dialog titles and errors, `aria-current` navigation, and pressed states for formatting controls. Make targets at least 24px with spacing and aim for 44px on touch surfaces. Focus rings cannot be clipped by scroll containers. Keyboard shortcuts are discoverable and must not hijack ordinary typing or browser behavior.

Command menus and dialogs trap focus appropriately, support Escape, and restore focus to their opener. Citation popovers are nonmodal where appropriate. Sheet/drawer scroll locking must release on navigation and interruption. Keep focus on a stable heading/landmark after workspace navigation; do not move it for background polling. Avoid announcing the full document each time readiness changes.

## 8. Implementation order and verification

1. **Foundation:** after approved backend scaffolding, install Manrope/selected primitives, replace tokens and radius overrides, split persistent app/auth/workspace layouts, mirror SSR composition, and remove starter branding. Verify light/dark auth and recovery before moving the editor.
2. **Workspace navigation:** connect server-derived provider, selector/unsaved guard, home, projects, lists, settings, members and invitations. Use real endpoint props/capabilities; no mock enabled actions in production screens.
3. **Shared library and input:** connect uploads, processing and file-owner controls; add all project-information fields, project assignment, deadline and explicit source mode. Verify selected source state survives navigation/retry without crossing tenants.
4. **Editor shell:** introduce responsive columns, document canvas, stable formatting/save behavior, inspector/citations/issues and server readiness. Preserve existing editor selection/polling behavior with meaningful regression checks.
5. **Review and export:** connect exact-version review, warning acknowledgments, owner approval, invalidation, preview and approved PDF tasks. Verify conflicts while a second member edits.
6. **Visual acceptance:** run the matrix below against implemented backend fixtures, capture actual desktop/mobile light/dark evidence, inspect final PDFs, and record remaining defects before delivery.

| Area                         | Required verification                                                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenancy                      | Two workspaces with similar names/files; switch, back/forward, direct links, revoked membership, delayed responses, and unsaved changes. No previous-tenant content or counts appear.                                        |
| Permissions                  | Member/owner/uploader combinations, including workspace owner who does not own a document/file. Hidden controls match server denial behavior.                                                                                |
| Authentication / invitations | Sign-in preservation, initial workspace, matching/wrong account, expiry, revocation, duplicate acceptance, SMTP failure/retry.                                                                                               |
| Input and metadata           | Draft empties vs review requirements, long values, nullable/past deadline without timezone shifts, metadata conflicts, shared source picker and input-only mode.                                                             |
| Editor                       | Keyboard formatting, stable selection/scroll during polling, failure/retry, concurrent saves, AI proposal acceptance, stale result rejection, citation focus and missing evidence.                                           |
| Issues / readiness           | Open/resolved and blocking combinations; all 16 completion-flag combinations yield the expected sum at the pure calculation boundary; integration tests enforce valid stage prerequisites and visible reasons.               |
| Review / export              | Nonowner approval denied, exact version/audit, edited approval invalidated, blocker invalidation, preview label, rejected unapproved/stale final download, rendered approved PDF content.                                    |
| Responsive                   | 360/390px mobile, 768px tablet, 1024px compact desktop, 1440px desktop and wide screenshot-scale layout. 200% zoom; long names, many sources, empty states, slow tasks, narrow/short viewports.                              |
| Accessibility                | Full keyboard route through selector/editor/sheets/dialogs, focus restoration, screen-reader labels and announcements, contrast measurements, light/dark, reduced motion/transparency, increased contrast and forced colors. |
| Visual fidelity              | Compare document width/spacing, panel proportions, typography, exact tokens, neutral/yellow sidebar and pill CTA to the supplied sources. Distinguish reviewed screenshot evidence from untested browser behavior.           |

Run appropriate checks after each affected implementation phase; the backend plan supplies full cutover verification:

```bash
node ace schema:generate
node ace codegen
node ace list:routes --jsonl
npm run typecheck
npm run lint
node ace test browser
npm run build
git diff --check
```

Browser tests require the configured test database, web server and fixtures; queue-dependent scenarios also require their worker/dispatch setup. Run the complete test suite at integration handoff as described in the backend plan. Generated types, lint and build success do not establish responsive, keyboard or rendering quality; capture and inspect those separately. The existing typecheck passed during research, but this documentation delivery does not claim that any redesigned UI, SMTP flow, private storage path, migration or worker behavior has been implemented or visually verified.

## 9. Review boundary

These three documents are the requested review deliverable. Application coding, package installation, schema migrations and production changes begin only after the user's approval, in the dedicated implementation worktree. Actual legacy conflict mappings, private bucket policy, SMTP sender details and approved brand artwork remain rollout inputs listed in the backend plan. Their absence does not prevent review of this concrete specification.
