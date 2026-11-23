# Canvas: image support, and deletions that reach the PDF

Branch: `feature/canvas-images-and-delete-sync` (from `dev`).
Builds on the canvas editor in `docs/pr/canvas-editor.md`.

## Summary

Two bugs are fixed: boxes deleted in the canvas stayed in the PDF preview, and a new image box
blocked saving. Pictures are now easy to work with: an image library, a focal point for cropped
pictures, fit-box-to-picture, and drag-and-drop or paste of image files onto a page. Two
maintenance commands come with it: `canvas:audit` and `images:measure`.

## Bug 1: deleted boxes still showed in the PDF

**Symptom:** you delete a box (or a page) in the canvas, open **Preview**, and the deleted box is
still there.

**Cause:** the editor autosaves edits to a *draft*, but the preview drew the last *saved
version*. A deletion only reached the PDF after **Save version**. Three smaller problems added to
it:

- Preview opened at once, so a change still waiting for the 1.5 s autosave timer was lost.
- Two autosaves could run at the same time with the same revision, and the second failed with
  "changed in another tab" (409). After that, autosave stopped.
- Bug 2 below made autosave fail outright on any canvas with a new image box.

**Fix:**

| Where | Change |
|---|---|
| `CanvasService.previewProject` | Returns the draft when it was started from the version being previewed, otherwise that version's canvas. The draft is checked with `parseCanvas` again. |
| `DocumentExportService.preview` | A preview of the *current* version draws the draft (`draft: !final && !versionId`). Final exports and pinned versions (collections) still draw only the saved version, so approvals keep their meaning. |
| `canvas_renderer.ts` | When the draft is drawn, the preview banner reads `PREVIEW · UNSAVED CHANGES · NOT APPROVED FOR FINAL EXPORT`. |
| `use_canvas_editor.ts` | `flush()` saves pending changes and waits for any save in flight. Autosaves now run one at a time. |
| `pages/documents/canvas.tsx` | **Preview** opens the tab, calls `flush()`, then loads the preview. |
| `create_editor.ts` | Every `component:remove` counts as a change. The listener starts only once the editor is ready, because loading the project removes GrapesJS's starting content. |

## Bug 2: a new image box blocked saving

**Symptom:** after adding an *Image* box, autosave showed "Not saved" and **Save version** failed
with "The canvas is not valid: …alt: expected string, received null". Clearing a big number's
label did the same.

**Cause:** the body parser (`convertEmptyStringsToNull`) turns `''` into `null`. New image boxes
start with `alt: ''`.

**Fix:** `alt` and `label` accept `null` and store it as `''` (`clearable()` in
`shared/canvas/model.ts`).

## Image support

### Database

Migration `1795415943168_alter_document_images_add_dimensions`:

| Column | Type | Notes |
|---|---|---|
| `document_images.width` | `integer NULL` | Pixels, read from the PNG/JPEG header at upload |
| `document_images.height` | `integer NULL` | Check: both null, or both > 0 |

Images uploaded earlier have no size until you run `node ace images:measure`.

### Stored canvas (no migration: JSON in `document_canvases.project`)

Image frames have an optional `focus: { x, y }` (integers 0–100, percent of the picture). It is
the point kept in view when *Fill the box* (`cover`) crops the picture. Without it, the picture
is centred. Old canvases stay valid. Editor and export share `imageCss()`
(`object-fit` + `object-position`), so the PDF matches the editor.

### API

`GET /workspaces/:workspaceId/documents/:documentId/images` (`documentImages.index`) lists the
document's images, newest first: `{ id, filename, mime, byteSize, width, height, src }`. It has the
same access rules as viewing an image: other workspaces get 404, guests get 401. The upload
response now includes `width` and `height` too.

### UI

**Inspector, Image section** (`inspector.tsx`):

- `image_library.tsx`: the document's images as thumbnails. Click one to use it, or upload a new
  one (it is used straight away).
- `focal_point.tsx`: click, drag, or use the arrow keys (5 %, or 1 % with Alt) to set the focal
  point. It is shown when the fit is *Fill the box*.
- **Fit box to picture**: keeps the width and sets the height to the picture's proportions. It
  shrinks the box if it would run off the page.
- **Centre** resets the focal point. **Remove picture** empties the box.

**On the canvas** (`create_editor.ts` + `use_canvas_editor.ts`):

- Drop image files on a page to add image boxes at the drop point, at each picture's proportions
  (80 mm wide). Several files cascade 5 mm apart.
- Drop an image file on an image box to replace its picture. Locked boxes are left alone.
- Paste an image (for example a screenshot) to put it in the selected image box. With no image
  box selected, it goes in the middle of the selected page.
- The page or box under the pointer is outlined while you drag. A file dropped beside the canvas
  is ignored, so the browser does not open it.
- The header shows "Uploading image…". **Save version** waits until uploads finish.

`images.ts` holds the upload helper and checks type and size (PNG/JPEG, 10 MB) before upload. The
server checks again. It also keeps one shared list of images per document, so a dropped picture
appears in the library at once.

Security is unchanged. A frame can only point to an image of its own document (`parseCanvas` with
`imageIds`). The export embeds pictures as `data:` URLs, and the renderer refuses any other
address.

## CLI commands

```bash
# Draft vs saved version and image problems, for every canvas document in a workspace
node ace canvas:audit --workspace=<uuid> [--document=<uuid>] [--json]

# Fill in width/height for images uploaded before sizes were recorded
node ace images:measure [--limit=500] [--dry-run]
```

`canvas:audit` reports, for each document:

- the saved version and its page count
- the draft: its revision, whether it is stale (started from an older version, so ignored), and
  the boxes and pages it deleted or added
- image boxes that are empty, missing their picture, or unmeasured
- stored data that fails the schema

It changes nothing. It exits 1 when a picture is missing or stored data is invalid.

`images:measure` reads only images that have no size, so it is safe to run again. It exits 1 if
a file could not be read.

## Tests

| File | Covers |
|---|---|
| `tests/unit/canvas_model.spec.ts` | `null` alt text and labels read as empty |
| `tests/unit/canvas_images.spec.ts` | Focal point limits, `imageCss`, `imageGeo`, `fitToImage`, the renderer embedding only `data:` pictures |
| `tests/functional/canvas_delete_sync.spec.ts` | A deleted box or page, and emptied text, reach the preview (autosaved and saved). Pinned versions ignore the draft. A new empty image box saves. |
| `tests/functional/canvas_images.spec.ts` | Sizes recorded at upload, the image list (order, isolation, auth), an uploaded picture printed embedded at its focal point |
| `tests/functional/canvas_audit.spec.ts` | Draft diff, image problems, stale drafts, workspace isolation, both commands |
| `tests/browser/canvas_images.spec.ts` | Place an image box, upload, fit, set the focal point, preview, delete, then Preview at once: the box is gone |

## Running it

```bash
node ace migration:run                    # dev database
NODE_ENV=test node ace migration:run      # test database (TEST_DB_URL)
node ace images:measure                   # backfill sizes for existing images
```

Set `CANVAS_EDITOR=pilot`, open a brochure, click **Canvas**, and drop an image file on a page.

## Not in this change

- Cropping to an exact rectangle (only the focal point with *Fill the box*).
- Deleting images from the library. Images stay with the document, as text-editor images do.
- Images inside text boxes from the canvas (the text editor already supports them).
- WebP/GIF uploads (the upload check accepts PNG and JPEG only).
