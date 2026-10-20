# Minimal creation revision

User direction, 16 October 2026: use the supplied Linear screenshots for hierarchy and restraint. This refines the approved redesign in the existing isolated workspace worktree.

## Research and decisions

Current creation shows all seven project-information inputs at once; project creation/editing are permanent forms; desktop sidebar has no visible collapse control; project links lose project context; source selection cannot upload in place. Adopt a centered conversational case-study composer, compact project dialogs with TipTap descriptions, flat lists and a shadcn icon-collapsible sidebar. Retain HumbleBeeAI tokens, current tenancy, permissions and review requirements. Do not copy Linear's unrelated issue metadata or colors.

The conversation is guided setup: each answer maps to an explicit project-information field. It does not claim AI-generated replies. Users can open a draft after their initial brief or continue optional follow-up prompts; the existing attributed generation action remains in the editor. TipTap is reused for rich descriptions and chat composition. Plain text remains available for search/model input; optional normalized JSON retains formatting. Existing plain descriptions continue to render safely.

## Defects and phases

D1: all-input case-study creation → conversational brief, editable answers and optional follow-ups.
D2: permanent project forms → create/edit dialogs with borderless title and rich description.
D3: non-collapsible desktop navigation → shadcn icon collapse with always-visible toggle and accessible icon links.
D4: lost project context → authorized project preselection and contextual creation links from project/case-study screens.
D5: external upload flow → shared source picker with searchable library/new upload tabs, preserving selection and drafts on failure.

1. Persist normalized rich descriptions additively; validate plain/rich consistency, retain compatibility and current-workspace checks.
2. Build reusable rich editor, project dialog and source picker; update projects and case-study metadata.
3. Replace creation with guided conversation and simplify navigation/list/editor framing.
4. Verify HTTP persistence/isolation and contextual creation, typecheck, lint, tests/build. Browser QA remains subject to the previously reported browser permission restriction.

## Architecture and data

Pages compose ProjectDialog, RichTextEditor and SourcePicker; controllers validate/delegate; RichTextService normalizes the supported TipTap subset and derives plain text. `projects.description_content` and `documents.description_content` are nullable JSONB. Existing descriptions are retained. Workspace route context scopes project preselection and file writes; file uploads immediately join the shared library and selection is attached when the draft/source choice is saved.

Existing POST/PUT project and document endpoints accept optional `descriptionContent` JSON; their existing plain `description` is the derived projection when JSON is supplied. Transformers expose both. No new provider/API dependency or public storage path is introduced. Invalid rich content returns 422; unauthorized project/file IDs retain 404 behavior. Rich-content changes invalidate document review with other writing inputs.

## Risks and verification

Rich JSON must not accept image/citation nodes or unsupported links. Dialog closure confirms unsaved changes. New uploads remain in the workspace library when a draft is cancelled, explicitly explained in the picker. Project creation context never authorizes access. Follow-up prompts are optional but review still requires seven completed fields. Test rich formatting roundtrip, unsafe content rejection, project preselection/isolation, and existing workflow regression. Run migration only on the disposable test database, regenerate schema/types, then typecheck/lint/tests/build and diff whitespace checks. No production migrations or deployment are part of this revision.

## Implementation and verification

Implemented in the existing `codex/workspace-tenancy` worktree. Project creation/editing now use a compact dialog and a TipTap description, project lists use quiet rows, and the workspace home removes the dashboard card grid. Case-study creation uses a centered rich-text chat composer, editable conversational answers, optional follow-ups and an immediate draft action. Project context is authorized and preselected; an existing case study can start another in its current project. The shared source dialog provides searchable library selection and new uploads in both creation and the document inspector. It explains immediate library persistence and guards staged uploads when leaving or switching tabs.

The installed shadcn sidebar uses icon collapse with a visible toggle, accessible expanded state and named collapsed links. The main editor uses a flat reading surface. App-wide heading scale and surrounding decoration are reduced while retaining brand tokens. New nullable JSONB description columns preserve existing text and retain normalized formatting; their plain projection is derived on the server. Stable content comparison avoids invalidating review solely because PostgreSQL reordered JSON keys.

Verification: 61 tests passed, 2 opt-in integration tests skipped (SMTP and provider transport); typecheck and full lint passed; production build passed. New HTTP/database coverage verifies rich description persistence, unsafe content rejection, authorized project preselection, source attachment and review preservation/invalidation. The additive migration ran only on the disposable local test database. Browser visual/keyboard/mobile verification remains unavailable under the previously reported browser access restriction; screenshots supplied by the user were inspected as design references. No production migration, deployment or remote API call occurred.

Library API references checked against installed usage: [TipTap React](https://tiptap.dev/docs/editor/getting-started/install/react) and [shadcn sidebar](https://ui.shadcn.com/docs/components/sidebar). Existing primitives were reused; no component installation or dependency addition was required.
