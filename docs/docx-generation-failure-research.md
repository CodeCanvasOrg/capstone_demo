# DOCX source preparation failure

## Problem and evidence

Investigated on clean `main` on 2026-10-20.

- `app/services/documents/files_service.ts:234` passes Mammoth's HTML fragment directly to xmldom's document parser. Installed versions: `@xmldom/xmldom` 0.9.12 and Mammoth 1.13.0 (bun.lock).
- Parsing `<p>First paragraph from the document.</p><p>Second paragraph.</p>` with the installed parser reproduces the reported fatal error at line 1, column 42. Wrapping that fragment in `<html><body>...</body></html>` parses successfully and preserves both paragraphs.
- Read-only inspection of the configured development database found generation task `7f2b990d-f451-43fc-b587-372c5ec78cca` in `conflict`, pinned to failed processing run `d30a0d5f-9b89-4137-9ffe-d971a9ce5eb4`.
- `GenerationService.execute` rejects failed pinned sources with a local workspace conflict (409). The generation job labels any error status `providerStatus`, so that log does not establish that OpenRouter returned 409.
- `ProcessFile.execute` catches and discards the extraction exception, making the original failure difficult to diagnose. The database retains a generic safe error, not the parser exception, so the historical extraction cause cannot be proved from the task row alone.

## Options and recommendation

Wrap Mammoth's generated fragment in a single HTML document root before parsing. This retains the existing extraction visitor and adds no dependency. Mammoth produces the fragment internally; this is not a general-purpose HTML parser replacement.

Replacing the parser adds dependency and compatibility work without being necessary for this fragment shape. Suppressing the parser's fatal error loses source content and is rejected. Changing generation's stale-input guards or silently skipping failed evidence would weaken existing guarantees and is rejected.

## Risks and limits

Regression coverage must exercise real DOCX conversion with multiple sibling blocks, rather than only a synthetic parser call. Cover headings, paragraphs, lists, tables, empty content, and embedded-image handling where practical. Keep diagnostic details in server logs and retain safe public errors. A code fix does not revive an already terminal processing run; recovery must use the existing authorized source-preparation and generation paths. No task rows were modified during investigation.
