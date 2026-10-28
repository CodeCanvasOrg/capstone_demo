# Company document templates — implementation plan

This replaces the previous canonical block/template implementation following the user's correction. Templates are company-owned Markdown documents explaining the desired output to the LLM. Users select templates and edit generated case studies; they cannot create or edit templates.

## Architecture and contract

`resources/document_templates/*.md` contains three company guides: website portfolio, technical portfolio and product vision. Each contains editorial instructions and a Markdown outline with headings and placeholders, based on the attached company output specification. These are editorial references, not facts about the user's project.

A read-only catalog service loads allowlisted files, validates the outline, and computes a revision hash. Create Case Study displays the company choices and a read-only outline preview in place of the former submit button. Selecting a template submits the existing document creation endpoint with `templateId` (`portfolio`, `technical`, or `vision`). The server freezes the selected guide in the document and queues normal generation. Existing clients default to the portfolio guide.

The provider receives the trusted company guide, brief and authorized sources. It returns ordinary rich text for the requested sections. The application assembles the headings in order. Generated content remains editable using the existing TipTap editor, evidence hydration, versioning and review workflow. Missing evidence must remain explicit. No custom-template write endpoints, template editor, canonical claim approval or special export pipeline remain.

GET `/workspaces/:workspaceId/templates` returns the read-only company catalog. Existing document creation and generation routes retain workspace authorization. Unknown template IDs fail validation. Template bodies sent by clients are ignored. Resources are included in the production build.

## Existing data and preview

Keep applied migrations and immutable historical versions. `node ace convert:template-documents` appends a regular rich-text version for old template documents and preserves original versions/evidence. It cancels active old generation requests, revokes obsolete approvals and records conversion. Re-running it is a no-op. It does not generate new provider content or delete original records.

The reported Chromium error is an operating-system launch denial. Document preview uses authorized HTML without launching Chromium. Server PDF requests report a concise actionable error when Chromium is unavailable; browser Print → Save as PDF remains available from preview.

## Verification

Run `node ace codegen`, `npm run typecheck`, `npm run lint`, unit and functional suites against the disposable test database, and `npm run build`. Test company selection and prompt snapshots, rejected arbitrary IDs, lack of authoring endpoints, generation formatting, cross-workspace isolation, conversion/history preservation and HTML preview/PDF launch failure. Inspect the runtime after guarded integration. Report browser/provider verification separately from local tests.

## Verified implementation — 27 October 2026

- The integrated checkout passes 140 unit/functional tests; 2 existing opt-in checks are skipped. Coverage includes company catalog authorization, rejection of arbitrary template IDs, absent template-write routes, guide snapshots at creation, editable generation structure, conversion of immutable canonical versions, private HTML preview and safe Chromium launch failure handling.
- Ace code generation, backend/frontend type checks, lint and `git diff --check` pass. The isolated replacement checkout builds successfully, including all three Markdown guide resources in production output.
- Local development server restarted on port 3344; `/login` responds HTTP 200.
- Converted one existing template document. Its original version and six terminal task records compare unchanged before/after. No template-mode documents remain. The replacement is a new ordinary editable version; previous generated text was retained.
- Live LLM generation and a signed-in browser walkthrough were not re-run. Postman's HTTP simulation remains blocked by its normal local dataset access permissions. Internal model-output tests verify prompt assembly and persistence, not provider output quality. The opt-in HTTP transport test and checked-in mock now cover company outline generation when simulation access is available.
- Server PDF generation still requires an environment that permits Chromium. The normal preview now serves authorized HTML; browser Print → Save as PDF can be used from that preview.
