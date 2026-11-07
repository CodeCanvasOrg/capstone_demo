# Project files implementation plan

Date: 5 November 2026

Status: Implemented on branch `feature/project-files`. Revised after review to use a `project_files` pivot table instead of a `files.project_id` column; everything else follows the approved plan.

## 1. Goal

Source files belonged only to a workspace and were offered to every case study in it. Projects now have their own files: uploaded or linked from the project, listed on the project, and offered only to that project's case studies. The shared workspace library keeps working as before.

## 2. Decisions

1. **Pivot table.** `project_files (workspace_id, project_id, file_id)` links files to projects. A file can belong to several projects without being copied, and adding scopes later (e.g. roles on the link) does not touch `files`.
2. **Scope is derived from links.** No links → workspace file (every existing file). One or more links → project file, offered only to those projects.
3. **Source rule.** A case study may select a file when the file has no project links, or is linked to the case study's project. An ungrouped case study sees workspace files only.
4. **Two layers of enforcement.** Services check the rule inside their existing locked transactions and return 409 with a readable message. Deferred constraint triggers reject any commit that breaks it, so a missed code path cannot leak a project file into another project.
5. **Storage keys unchanged.** Objects stay at `workspaces/{workspaceId}/originals/...`. Linking/unlinking is metadata only; no copy, re-ingest or re-embedding.
6. **Owner-only linking**, matching rename/delete (`FilePolicy.manageProjects`). Operators can link in bulk with an Ace command.
7. **Conflicts are refused, not auto-resolved.** A change that would leave a case study using a file it may no longer use (linking a used workspace file to a different project, unlinking the project a case study relies on, or moving a case study to another project) returns 409 naming the affected items.
8. **Retrieval, ingest and evidence unchanged.** They already scope through `document_files`, so restricting what can be linked there is sufficient.

## 3. Database schema

### 3.1 `project_files` — `database/migrations/1793866501407_create_project_files_table.ts`

| Column                     | Type           | Notes                                                                  |
| -------------------------- | -------------- | ---------------------------------------------------------------------- |
| `id`                       | uuid PK        | `gen_random_uuid()`                                                    |
| `workspace_id`             | uuid NN        | → `workspaces.id`, cascade                                             |
| `project_id`               | uuid NN        | (`workspace_id`, `project_id`) → `projects(workspace_id, id)`, cascade |
| `file_id`                  | uuid NN        | (`workspace_id`, `file_id`) → `files(workspace_id, id)`, cascade       |
| `created_by`               | integer NULL   | → `users.id`, set null                                                 |
| `created_at`, `updated_at` | timestamptz NN | default now                                                            |

- UQ (`workspace_id`, `project_id`, `file_id`); index (`workspace_id`, `file_id`) for "which projects is this file in".
- Composite FKs keep both ends in the link's workspace (same pattern as `documents.project_id`).
- Deleting a file or project removes its links. Deleting a project's last link makes the file a workspace file again.

### 3.2 Source-scope trigger — `database/migrations/1793866501827_create_project_source_scope_trigger.ts`

- `project_source_scope_violated(document, file)` — SQL function returning whether any matching `document_files` row breaks the rule.
- `enforce_project_source_scope()` — trigger function; raises SQLSTATE `23514` (`project_source_scope`).
- Deferred constraint triggers: `document_files_project_scope` (insert/update), `project_files_project_scope` (insert/update/delete), `documents_project_scope` (update of `project_id`).

### 3.3 Models

- `app/models/project_file.ts` (new, schema class generated into `database/schema.ts`).
- `File.projects` and `Project.files` — many-to-many through `project_files`.

## 4. Backend

| Piece                                                                                             | Location                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule helpers: `eligible()` query scope, `ineligible()`, `assertSelectable()`, `conflicts()`       | `app/services/files/source_scope_service.ts`                                                                                                                                                                        |
| Link/unlink with conflict checks (`attach`, `detach`, `link` for operators), `violations()` audit | `app/services/files/project_files_service.ts`                                                                                                                                                                       |
| Upload into a project (`projectId` optional, validated under the membership lock)                 | `app/services/upload_service.ts`, `app/validators/upload.ts`, `app/controllers/uploads_controller.ts`                                                                                                               |
| Enforcement on create / project change / source selection                                         | `app/services/documents/document_service.ts`, `app/services/documents/source_selection_service.ts`                                                                                                                  |
| Routes                                                                                            | `POST /workspaces/:workspaceId/files/:id/projects` (`fileProjects.store`), `DELETE /workspaces/:workspaceId/files/:id/projects/:projectId` (`fileProjects.destroy`) → `app/controllers/file_projects_controller.ts` |
| Policy                                                                                            | `FilePolicy.manageProjects` (owner)                                                                                                                                                                                 |
| Listing                                                                                           | `FilesController.index` `?scope=all                                                                                                                                                                                 | workspace | <projectId>`; `create`takes`?projectId=`; `edit`loads projects.`ProjectsController.show`adds`files`and`attachableFiles`. `DocumentsController.edit`offers only eligible files;`create` sends all files with their projects for client-side filtering. |
| Transformer                                                                                       | `FileTransformer`: `projects: {id, name}[]` when preloaded, `capabilities.manageProjects`                                                                                                                           |

Error messages:

- "These sources belong to another project: … Choose workspace files or files from this case study's project."
- "This file is used by case studies outside its projects: … Remove it from them first."
- "This case study uses files from its current project: … Remove them before moving it."

## 5. CLI

Scaffolding used: `node ace make:migration`, `make:model project_file`, `make:controller file_projects`, `make:command link_project_files`, `make:command verify_project_files`, then `node ace migration:run` (dev and `NODE_ENV=test`) and `node ace codegen`.

**`files:project-link`** — bulk link/unlink (operator; skips the owner check, never forces a conflict).

```sh
node ace files:project-link --workspace=<id> --project=<id> --files=<id>,<id> --dry-run
node ace files:project-link --workspace=<id> --mapping=./links.json --apply      # [{ "fileId": "...", "projectId": "..." }]
node ace files:project-link --workspace=<id> --project=<id> --files=<id> --unlink --apply
```

Each pair runs in its own savepoint; output is `{ applied, change, changed, unchanged, skipped: [{ fileId, projectId, reason }] }`. Exit code 1 when anything was skipped.

**`files:verify-project-scope`** — audit; exit code 1 on any violation.

```sh
node ace files:verify-project-scope [--workspace=<id>]
```

## 6. UI

| Component                                                                                       | Change                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inertia/components/projects/project_files.tsx` (new)                                           | Files section on the project page: list with status, "Upload files" dialog (uploads linked to the project), "Add existing" dialog (actor's unlinked files), remove-from-project button, polling while processing. |
| `inertia/pages/projects/show.tsx`                                                               | Renders `ProjectFiles` above case studies.                                                                                                                                                                        |
| `inertia/components/files/file_location.tsx` (new)                                              | "Location" panel on the file page: linked projects with remove, add-to-project select, workspace-library state.                                                                                                   |
| `inertia/components/files/project_badges.tsx` (new)                                             | Project badges on library rows.                                                                                                                                                                                   |
| `inertia/pages/files/index.tsx`                                                                 | Location filter (All / Workspace library / project), badges, scope kept in search and pagination.                                                                                                                 |
| `inertia/pages/files/create.tsx`, `components/files/user_form.tsx`, `components/files/form.tsx` | "Save to" select; upload form sends `projectId`.                                                                                                                                                                  |
| `inertia/components/files/source_picker.tsx`                                                    | `projectId` prop, `selectable()` rule, groups "This project" / "Workspace library", uploads go to the case study's project.                                                                                       |
| `inertia/components/documents/form.tsx`                                                         | Passes the chosen project; changing project drops sources that no longer qualify and says how many.                                                                                                               |
| `inertia/components/documents/inspector.tsx`                                                    | Passes the case study's project to the picker.                                                                                                                                                                    |

## 7. Verification

- `tests/functional/project_files.spec.ts` (12 tests): upload linking, cross-workspace refusal, source rule on create/selection/project change, multi-project files, attach/detach conflicts, trigger backstop, owner-only routes, editor offers only eligible files, both Ace commands.
- `tests/browser/project_files.spec.ts`: link from the project page, picker grouping and exclusion, unlink.
- Full functional + unit suites: 184 passed before the PDF worker was set up in the worktree; the 8 PDF-worker tests then passed after `bun run python:setup`. Browser suite: 13/13. Backend and frontend typecheck clean; ESLint clean.
- Migrations run, rolled back and re-run on the test database; applied to the dev database.
