---
name: feature-pipeline
description: Use when starting or planning any non-trivial feature, bug fix, refactor, or dependency addition in capstone_demo — anything bigger than a one-line change. Triggers on "add a feature", "build X", "implement X", "plan this", "how should we do X", "should we use X library", "start on X", "new endpoint", "big change". Runs the pipeline research → research doc → implementation plan doc → architecture doc → implement in a git worktree.
---

# Feature pipeline for capstone_demo

Do not start coding. Five stages, in order, each producing an artifact the next one
consumes. Skipping the doc stages is how this project produced 13 latent defects in the
document pipeline.

`.agents/docs/working-rules.md` is binding: **every significant change happens in a
dedicated git worktree**, plan before writing code, prefer the CLI over hand-written
scaffolds, keep logic in layers, verify with tests or a manual run.

## Stage 0 — Isolate

First, always. Never work on a feature in the main working tree.

```bash
git worktree add -b feature/<name> ../capstone_demo_<name>
```

Commit `.agents/docs/*` plans in the main repo (they're shared reference), then do the
code in the worktree.

## Stage 1 — Research

Understand before designing. Use `websearch` / `webfetch` for anything external
(library APIs, version compatibility, prior art) and read the codebase for anything
internal.

- Check the installed version before reading docs for a library — `package.json`, then
  the changelog/release notes. Docs describe latest; the repo pins a version.
- Search for prior art in this repo first: `.agents/docs/rag-document-processing-research.md`
  and `.agents/docs/rag-implementation-plan.md` are the worked examples of this stage.
- Write down what you learned, including what you ruled out and why.

**Deliverable:** raw findings, in-conversation or as notes. Do not skip to design.

## Stage 2 — Research doc

`.agents/docs/<feature>-research.md`

Answers *what and why*, deliberately **not** how:

1. Problem statement and current behaviour
2. Options considered, each with trade-offs
3. Recommendation and the reasoning that killed the alternatives
4. Version / compatibility facts (installed version, breaking changes, peer deps)
5. Open questions and risks

Keep it implementation-agnostic. A reader should be able to disagree with the
recommendation without having seen code.

## Stage 3 — Implementation plan doc

`.agents/docs/<feature>-implementation-plan.md`

Answers *how*, sequenced and verifiable. The existing
`rag-implementation-plan.md` (668 lines) is the template. Its section order:

1. **Decisions** — the recommendations carried forward from research, one line each
2. **Current-state audit** — what exists today, with file:line, plus a
   recommendation→status matrix (`adopted` / `rejected` / `deferred` + reason)
3. **Defects to fix first** — numbered D1, D2, … each with location, symptom, fix
4. **Target architecture** — a mermaid diagram of the end state
5. **Data model** — tables, columns, types, indexes, constraints
6. **Phases** — each phase independently shippable and independently verifiable, with
   its own acceptance criteria
7. **Risks and mitigations**
8. **Open questions** — things that must be answered before or during a phase
9. **Verification** — the exact commands and manual steps that prove it works

Rules that make these docs useful:

- Lead with defects. If the audit finds broken things, phase 0 is fixing them, not
  building.
- Number defects and reference them by ID from every later phase.
- Phases must be ordered by dependency, and each must leave the app working.
- Every phase gets concrete acceptance criteria — a command that passes, or a click path.
- Include real code blocks for schema and the tricky parts only; not whole files.
- Balance every ``` fence.

**Before writing any code, surface the plan to the user and get agreement.** This is the
gate that prevents wasted work.

## Stage 4 — Architecture doc

Only if the change introduces or reshapes structure (new layer, new service, new
relationship between modules, new infra dependency). For a single-file fix, fold this into
the plan doc's architecture section instead.

Covers: component boundaries, data flow, interfaces between new pieces, what depends on
what, where state lives, and the failure/rollback path. Prefer a mermaid diagram plus a
dependency list.

## Stage 5 — Implement

Only after the plan is agreed.

1. Work in the worktree from Stage 0.
2. Scaffold with `node ace` (see the `adonis-cli` skill) — never hand-write framework files.
3. Implement one phase at a time. Don't start phase 2 while phase 1 is unverified.
4. Land code in the layers the `design-patterns` skill defines.
5. Verify each phase with the commands its acceptance criteria name, then:

```bash
node ace codegen && npm run typecheck && npm run lint && npm test
```

6. Manual run when the change is user-visible: `./bin/run-dev.sh`, click the path.
7. Commit per phase with a message that names the phase.

## When something goes wrong

Re-enter at the earliest stage that is actually wrong. A discovery that invalidates the
architecture means going back to Stage 2, not patching Stage 5 and hoping. Update the doc
first, then the code.

## Anti-patterns

- Coding first, documenting afterwards
- Choosing a library from memory instead of checking the installed version
- One giant phase instead of independently shippable slices
- A plan with no acceptance criteria ("works well" is not verifiable)
- Defining a defect in phase 0 and then shipping phase 4 on top of it
- Editing files in the main working tree instead of a worktree
- Committing `.env`, API keys, or generated output

## Artifact naming

```
.agents/docs/<feature>-research.md
.agents/docs/<feature>-implementation-plan.md
.agents/docs/<feature>-architecture.md      # only when structure changes
```

Existing: `rag-document-processing-research.md`, `rag-implementation-plan.md`.