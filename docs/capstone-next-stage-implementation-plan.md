# Capstone next-stage implementation plan

14 November 2026 · Planning documents on current `dev` branch. Application work and tests already in progress are preserved.

Start with the [complete implementation index](next-stage/implementation-plan.md), covering all **38 backlog items**, then read the [closing implementation overlap note](next-stage/handoff-snapshot.md) before scaffolding anything.

- [Research, source precedence and test-contract gaps](next-stage/research.md)
- [Shared architecture and failure boundaries](next-stage/architecture.md)
- [Incremental database schemas and migrations](next-stage/data-model.md)
- [01 — Content, evidence and baseline](next-stage/01-content-evidence.md)
- [02 — Templates, branding, components and selection](next-stage/02-templates-ui.md)
- [03 — Rendering, page fitting and PDF production](next-stage/03-rendering-pdf.md)
- [04 — Editing, AI proposals and exact approval](next-stage/04-editing-approval.md)
- [05 — Portfolio collections and additional content types](next-stage/05-collections-types.md)
- [06 — Job stages, recovery and provider credentials](next-stage/06-jobs-providers.md)
- [07 — Regression checks, deferred formats and release](next-stage/07-quality-release.md)

Each plan specifies existing code to reuse, remaining behavior, UI components/states, API and authorization changes, schema impact, future CLI commands, dependency order and acceptance evidence. Final export remains **PDF only** under the accepted decision; older PPTX requirements are explicitly deferred. Policy-dependent final actions remain identified without blocking independent internal-preview work.

This task verified documentation coverage/links and CLI syntax; it did not implement features, alter tests, apply migrations or claim runtime acceptance.
