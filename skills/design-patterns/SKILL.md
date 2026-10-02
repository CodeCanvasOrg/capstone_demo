---
name: design-patterns
description: Use when deciding where code goes or how to structure it in capstone_demo — new service, refactoring a fat controller, extracting shared logic, naming/layering decisions, transactions, error handling, authorization, N+1 queries, transformer/validator/policy boundaries. Triggers on "where should this live", "refactor", "extract method", "clean up this controller", "too much logic in the controller", "DRY", "architecture", "layering", "which pattern", "is this too coupled", "duplicated logic". Describes the conventions this repo already uses.
---

# Design patterns for capstone_demo

The repo already runs a clean-ish layered architecture. Match it; do not invent a second
one. When unsure where code goes, use the decision table below and follow the existing
files.

## Layer map (dependency direction is one-way)

```
routes  →  controller  →  policy
                    ↓  →  validator
                    ↓  →  service  →  model  →  db
                    ↓  →  transformer
inertia page/component  ←  transformer output only
```

Nothing points backwards. A controller must never import another controller. A service
must never import a controller. A transformer must never query the database.

| Layer | Location | Responsibility | Never contains |
|---|---|---|---|
| Route | `start/routes.ts` | URL, verb, name, middleware stack | logic |
| Controller | `app/controllers/*_controller.ts` | HTTP in/out, authorize, validate, delegate | business rules, raw SQL, provider calls |
| Policy | `app/policies/*_policy.ts` | can this user do X on Y | queries unrelated to the decision |
| Validator | `app/validators/*.ts` | shape + format of input (VineJS) | DB lookups, business rules |
| Service | `app/services/**` | business logic, orchestration, I/O | `HttpContext`, Inertia, redirect/response |
| Model | `app/models/*` | persistence, relations, computed props | HTTP, formatting for the view |
| Transformer | `app/transformers/*_transformer.ts` | explicit pick of fields for output | DB queries, auth checks |
| Provider | `providers/api_provider.ts` | app-wide bindings/augmentation | feature logic |

Reference implementations to copy from: `app/controllers/documents_controller.ts`
(layering), `app/policies/document_policy.ts` (authorization + shared private helpers),
`app/transformers/document_transformer.ts` (explicit field selection), `app/services/documents/files_service.ts`
(strategy dispatch), `app/validators/document_share.ts` (typed enum via `as const`).

## Controller shape

```ts
async update({ params, request, bouncer, response }: HttpContext) {
  const document = await Document.findByOrFail({ id: params.id })
  await bouncer.with(DocumentPolicy).authorize('update', document)

  const payload = await request.validateUsing(documentValidator)

  document.merge(payload)
  await document.save()

  return response.redirect().toRoute('documents.edit', { id: document.id })
}
```

Five moves, in order: load → authorize → validate → act → respond. If `update` and
`destroy` in two controllers are 90% identical, the shared part is a service, not a
base class.

## Pattern catalogue

**Strategy / dispatch** — `files_service.ts` `switch`es on extension into `processPdf`,
`processDocx`, `processImage`. Add a new file type with a new `case` + one private method.
Do not grow an `if (isPdf) ... else if (isDocx)` chain.

**Template Method (implicit, private helpers)** — `splitText` is shared by every
processor; `processPdf` composes `processImage` + `splitText`. Public static entry point
(`processFile`), private static steps.

**Unit of Work / transaction boundary** — the transaction belongs in the layer that
knows what must be atomic, i.e. the controller or a coordinating service:

```ts
const trx = await db.transaction()
try {
  // ...all writes, each passing { client: trx }
  await trx.commit()
} catch (error) {
  await trx.rollback()
  logger.error({ err: error }, 'Failed to create document')
  return response.redirect().toRoute('documents.create')
}
```

Every query inside the block must receive `{ client: trx }` — one missing client silently
escapes the transaction. Note this repo does not `trx.rollback()` on the error path after
partial commit state in all handlers; check before copying.

**Repository-ish access** — use Lucid relations, not raw SQL:
`auth.user!.related('documents').query()`, `document.related('documentShares')`.
This is what makes ownership scoping automatic — prefer
`auth.user!.related('x').query()` over `X.query().where('userId', auth.user!.id)`.

**Null Object / fallback** — `this.whenLoaded(...)` in transformers turns "not preloaded"
into `undefined` instead of throwing. `'relation' in resource.$preloaded` is the guard
when a transformer must emit the key only sometimes.

**Facade (framework services)** — `db`, `drive`, `logger`, `request`, `auth`, `bouncer`
come from `@adonisjs/*/services/*`. Use these, not `new Database()`.

**Adapter** — third-party libraries are wrapped in one service, never called from a
controller: `open_router_service.ts` wraps LangChain/OpenRouter;
`files_service.ts` wraps `pdf-parse`/`mammoth`/`tesseract.js`. If a controller imports
`@langchain/*`, `pdf-parse`, `tesseract.js`, `mammoth` or `sharp`, that is a violation.

**Serializer / decorator** — `providers/api_provider.ts` extends `BaseSerializer` and
attaches `ctx.serialize()` to every `HttpContext`, so all API output is wrapped in `data`
with pagination metadata. Extend it; don't hand-roll a JSON envelope.

**Configuration Object** — `config/open_router.ts` holds env-driven config. Feature flags
and tunables belong in `config/*.ts` via `env.get`, never inline in a service.

**Convention over configuration** — singular services (`files_service.ts`),
plural resource controllers (`documents_controller.ts`), `*_transformer.ts`,
`*_policy.ts`. `FileService.createFileName()` holds the naming convention in one place.

## Guardrails

- **Authorization is not optional.** Every action that touches a user-owned row calls
  `bouncer.with(XPolicy).authorize(...)`. A missing authorize call is a security bug.
  Add the policy method and the call together.
- **Ownership via relations.** Scope by `related()` so ownership can't be forgotten.
- **Avoid N+1.** `preload()` relationships explicitly before looping. If a loop calls
  `await row.thing`, you're now issuing one query per row.
- **Don't leak columns.** Transformers pick fields; the model has every column. Adding a
  field to the DB does not make it frontend-visible.
- **Errors get logged with context**, never swallowed:
  `logger.error({ err: error }, 'Human-readable message')`. A bare `catch {}` loses the
  stack.
- **Constants are typed with `as const`** and exported from the validator or a shared
  module (`SHARE_ROLES`), so the DB, validator, policy and UI cannot disagree.
- **Prefer explicit small functions over clever abstractions.** Two call sites is the
  threshold for extracting; three for a shared abstraction. No premature base classes,
  interfaces-for-one-implementation, or generic frameworks.

## Testability

Pure-ish logic belongs where it can be unit tested without a database: `chunking`,
`scoring`, `parsing`, `formatting`. Current unit tests target exactly those
(`tests/unit/open_router_service.spec.ts`, `tests/unit/services/files_service.spec.ts`).
HTTP/authz/DB behaviour belongs in `tests/functional/` via
`node ace make:test <name> --suite=functional`.

## Review checklist

- [ ] Controller has no business logic; service has no `HttpContext`
- [ ] Every mutating action authorizes via a policy
- [ ] Transaction writes all pass `{ client: trx }`
- [ ] No third-party library imported outside its wrapper service
- [ ] Relationships preloaded, no per-row queries in loops
- [ ] Output goes through a transformer, no raw models to the frontend
- [ ] Names follow the existing singular/plural convention
- [ ] `node ace codegen && npm run typecheck && npm run lint` passes