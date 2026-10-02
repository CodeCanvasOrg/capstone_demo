# UI redesign research

## Problem and current behavior

Base: feature/rag-image-chunks at d2e66d4. The homepage mixes Code Canvas and Humblebee names with a REACT header mark, has inert CTA buttons, and advertises templates/charts/publishing that are not grounded in the current workflow. The app supports source uploads, processing status, document generation, editing, and citations.

## Options and recommendation

Use https://humblebee.ai/ as a reference for clear introductory messaging, numbered capabilities, and a section-based narrative. Preserve the local paper/ink/yellow palette, sharp corners, Instrument Sans, DM Serif Display, and existing product name pending confirmation. Avoid importing the reference's client logos, metrics, or unrelated services.

Recommended scope: homepage, shared navigation, authentication pages, documents/files lists and forms, and document editor framing. Preserve existing permissions, polling, processing states, citations, and editor behavior.

## Compatibility

The branch uses React 19, Tailwind 4, shadcn, Radix, Inertia, next-themes, and a Bun lockfile. Framer Motion is absent. Added framer-motion 14.0.0. The registry declares React/ReactDOM ^18.0.0 or ^19.0.0 peer support; the dependency change adds only Framer Motion and its transitive Motion packages to the existing Bun lockfile. Use MotionConfig reducedMotion="user" and useReducedMotion for bespoke effects per https://motion.dev/docs/react-accessibility.

## Risks and open questions

Keep REACT as the current visible identity until naming is settled. Avoid animations that interfere with editor selection, Radix focus, or async state updates. Browser approval rejected both the external reference and the local preview. The implementation uses previously retrieved reference content and the existing brand tokens; browser visual verification remains outstanding.
