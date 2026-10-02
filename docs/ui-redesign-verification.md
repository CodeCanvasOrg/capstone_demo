# UI redesign verification — October 2, 2026

Base: `feature/rag-image-chunks`, commit `d2e66d4`. Work: `codex/ui-redesign`.

## Implemented

- Replaced the placeholder homepage with a source-to-story hero, labelled illustrative workspace, numbered workflow, and real typed-route CTAs.
- Preserved the REACT mark, paper/ink/yellow palette, serif/sans typography, sharp corners, and shadcn/Radix primitives.
- Added Framer Motion 14.0.0 with shared reduced-motion policy and restrained section entrances; editor content remains outside motion wrappers.
- Updated authentication, navigation, list headers, create pages, source upload, file details, and editor framing. Mobile records stack; the toolbar wraps; auth navigation uses a Radix menu on mobile.
- Fixed request lifecycle feedback for document creation and file renaming, added adjacent validation feedback, disabled submit/delete controls during requests, improved focus visibility, and added an editor loading skeleton.
- Retained source membership, RAG status badges, polling, editor extensions/citations, sharing, and export behavior. No backend, data model, route, or existing test files changed.

## Automated checks

- `npm run typecheck`: passed.
- `./node_modules/.bin/eslint inertia`: passed.
- `git diff --check`: passed.
- `npm run build`: passed. Vite reports the existing large editor chunk warning.
- `npm run lint`: fails with nine Prettier formatting errors in the unchanged generated `database/schema.ts`. Reproduced on a clean archive of the base branch using the same installed dependencies.
- `npm test`: 18 passed, one failed. The unchanged OpenRouter constructor test compares an unwrapped API-key string with the configuration secret wrapper. Reproduced on the base branch. Verification reruns use a placeholder API key; no external AI requests are required by the mocked tests.
- Production server starts from `build` on port 3347. The copied, ignored local environment required the newer branch's APP_NAME/queue/Redis/RAG defaults. No environment changes are tracked.

## Contrast checks

Computed from the actual opaque theme tokens: light body 18.77:1; light muted text 6.61:1; dark body 17.60:1; dark muted text on cards 6.48:1; yellow button text 11.68:1. Light focus now uses ink (18.77:1); dark focus retains yellow (11.68:1). These token calculations do not replace browser verification of rendered combinations.

## Outstanding browser checks

Browser approval rejected both the Humblebee reference URL and the local preview URL. No alternate browser access was attempted. Visual, keyboard, and end-to-end form verification remains unverified.

Review the homepage/login/signup at mobile and desktop sizes in both themes. With an authenticated development account, check files/documents empty and populated lists, long filenames, upload staging and errors, file renaming validation, linked documents, RAG status refresh, generation failure, editor/citations, sharing/export, and delete dialog focus. Verify reduced-motion behavior and keyboard menu navigation. Avoid using production records for destructive checks.

## Preview

From `/private/tmp/capstone-ui-redesign/build`, start the production preview with:

```sh
NODE_ENV=production PORT=3347 HOST=127.0.0.1 APP_URL=http://127.0.0.1:3347 node --env-file=../.env bin/server.js
```

The preview is running at http://127.0.0.1:3347 at handoff. After source edits, run `npm run build` from the worktree and restart the preview.

## Git handoff

Changes are saved in the isolated `codex/ui-redesign` worktree but remain uncommitted. Staging was blocked by filesystem permissions when Git tried to create `.git/worktrees/capstone-ui-redesign/index.lock`. No merge or push was attempted.

## Follow-up fixes

- Claim popups: the editor canvas previously focused the editor on every bubbled click, including citation triggers and portal content. Focus now changes only when the user clicks the blank canvas itself. The citation popover retains Radix focus and dismissal behavior.
- Repeating file animations: status polling used GET visits without preserveState, remounting the page and restarting Reveal. File list, file details, and document generation polls now preserve component state while updating their requested props and retaining scroll.
- Browser regression checks remain pending: click a citation and keep its excerpt open; interact with the popup and dismiss with Escape/outside click; click the blank canvas to focus the editor; leave a processing file page open across several poll cycles and verify status updates without repeating entrances or losing form edits.
