# HTML exports research

2026-11-07. Proposed; implementation awaits agreement.

## Problem and findings

The system supports downloadable final PDFs and an HTML preview, but no final HTML download. `app/services/exports/pdf_service.ts` already generates a complete HTML document with inline styles and an embedded Manrope font. `DocumentExportService.content` hydrates citations and embeds authorized private images. Preview HTML carries a preview warning and is not subject to final-export readiness.

Final exports use queued render tasks, private storage, lease checks, mutation identity, and snapshot checks before rendering, publication, and download. Solo workspaces can export a meaningful saved draft; teams require exact-version approval. These rules should apply to HTML.

## Options and recommendation

| Option | Tradeoff | Decision |
| --- | --- | --- |
| Download preview HTML | Small change, but preview labeling and different approval guarantees | Reject |
| Generate in browser | Duplicates formatting, image hydration, and policy | Reject |
| Add format to existing final-export pipeline | Reuses authorization, snapshots, renderer, and task recovery | Adopt |

Produce one standalone `.html` file containing inline styles, font, and images. Citations remain readable offline; authenticated source links still require application access. HTML generation requires no Chromium.

## Compatibility and risks

The manifest declares Adonis core ^7.5.0, React ^19.2.8, Inertia React ^3.7.0, and TipTap HTML/core ^3.31.3. These are declared ranges, not verified installed versions. No new dependency is proposed; reuse the APIs already called by the HTML preview.

Absent format on existing tasks must mean PDF. Preserve existing PDF request fingerprints. HTML needs restrictive metadata CSP because HTTP response headers do not travel with downloaded files. Preserve schema normalization, protocol checks, safe serialization, and authorized asset embedding.

Sources inspected: export controller/services, `start/routes.ts`, document review validator, task service, editor page, export functional tests, and `docs/solo-export-contract.md`. The local Postman CLI rejected `postman status` as an unknown command. Existing local contracts and Japa HTTP tests provide the appropriate contract/verification surface; no remote workspace setup is necessary.

Documents are under `docs/` because this session prohibits writes to `.agents/docs/`.
