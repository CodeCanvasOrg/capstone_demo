# UI redesign implementation plan

## Decisions

Retain the brand tokens and shadcn primitives. Use restrained Framer Motion entrances and interaction feedback with reduced-motion support. Base all work on feature/rag-image-chunks.

## Current-state audit

- inertia/pages/home.tsx: inconsistent naming, inert CTAs, unsupported feature claims.
- inertia/layouts/default.tsx: shared auth navigation, theme provider, and flash feedback.
- inertia/css/app.css: existing sharp-corner paper/ink/yellow identity and theme tokens.
- inertia/pages/files/index.tsx: processing polling must remain intact.
- inertia/components/documents/document_card.tsx: generation states and destructive confirmation must remain intact.

Recommendations: adopt brand preservation, section-based storytelling, functional CTAs, and accessible motion. Reject borrowed customer claims. Defer new backend features.

## Defects first

D1: Homepage CTA buttons have no destination. Convert to existing typed Inertia routes.
D2: Homepage copy contains contradictory names and unsupported claims. Use actual source-to-document workflow and existing visible identity.
D3: Document creation and file editing dispatch through the router without updating useForm processing/errors. Track the request lifecycle and surface server validation so progress and disabled states work.
D4: Narrow workspace tables and the editor toolbar need wrapping; text and editor code colors need semantic theme tokens. Stack records on mobile and use existing theme tokens.

## Target architecture

Shared layout owns theme, navigation, flash feedback, and motion policy. Pages compose shared presentation components around existing typed data and feature components. Radix continues to own focus and dialog behavior. No new persistent state or database changes.

## Phases and acceptance criteria

1. Foundation: verify Framer Motion compatibility; add dependency and reduced-motion policy; improve responsive navigation. Keyboard navigation, logout, themes, and flash feedback work.
2. Homepage: resolve D1/D2; create editorial hero with product illustration, numbered upload/generate/refine workflow, and functional CTA. Check mobile, desktop, both themes, and reduced motion.
3. Workspace: unify list headers, empty states, forms, authentication, and editor framing. Verify upload, membership display, processing refresh, generation badges, editing, citations, export, and delete confirmation retain their behavior.

## Risks and mitigations

Keep animation outside editable content. Use tokens for every new surface. Avoid opacity that reduces text contrast. Keep data logic unchanged and review branch diffs for accidental backend changes.

## Open questions

User agreed to this scope on October 2, 2026. The existing REACT header identity is retained. Browser visual verification is outstanding because browser approval rejected access.

## Verification

Run npm run typecheck, npm run lint, npm run build, and relevant existing tests. Start with ./bin/run-dev.sh if available and manually verify keyboard focus, mobile overflow, light/dark modes, reduced motion, auth routes, and the files/documents workflows. Report infrastructure blockers separately from regressions.
