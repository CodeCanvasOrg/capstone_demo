# Image generation: viability research

Checked 2026-11-28 against OpenRouter's live catalogue and docs, plus one real probe call.

## Verdict: viable with limits

Image-output models can be called through OpenRouter, the project's existing provider, with the same
key. A single 3:4 picture costs about 3 to 7 US cents, comes back as a base64 PNG, and is close to
the print size of the figure frame. The limits are:

- **Latency is long.** The one probe took 61 s. Generation must run off the request path, with a
  timeout and a fallback, and never block a canvas run on it.
- **Resolution needs a small upscale at the cheap tier.** 1K output is 896 x 1200 px. The frame
  needs about 920 x 1290 px. A cover-fit resize gives about 280 dpi at 1K; the 2K tier gives well
  over 300 dpi at 1.5x the price.
- **Illustration only.** The evidence rules below apply and are enforced in code, not in the prompt.
- **Provider terms differ per model.** Ownership of the output follows each model's own terms.

## What OpenRouter offers

`GET /api/v1/models?output_modalities=image` listed 71 models; `GET /api/v1/images/models` lists 68
image-only models. There are two request paths.

1. **Chat completions with image output (used for the probe).** `POST /api/v1/chat/completions`
   with `"modalities": ["image", "text"]` (multimodal models such as the Gemini image models) and
   an optional `"image_config": {"aspect_ratio": "3:4", "image_size": "1K"}`. Reference images go
   in as `image_url` content parts, URL or data URL, as for vision input. The response puts the
   result in `choices[0].message.images[]`, each `{ "type": "image_url", "image_url": { "url":
   "data:image/png;base64,..." } }`. `message.content` was `null` in the probe. `usage.cost` gives
   the exact charge.
2. **Images API.** `POST /api/v1/images` with `model`, `prompt`, `resolution` (`1K`, `2K`, ...),
   `aspect_ratio`, `n`, `output_format` and `input_references` (up to 16 entries, per-model limits).
   The response is `{ data: [{ b64_json, media_type }], usage }` or signed URLs valid for 24 h.
   Models that exist only on the Images API cannot be used from chat completions.

Reference images (the multimodal input the task needs) are supported on both: 14 for
`google/gemini-3.1-flash-image`, 8 for FLUX.2 Pro, 14 for Seedream 4.5, 3 for Qwen Image 3.

### Candidate models

Prices are the live endpoint prices on the checked date.

| Model | Output | Price per image | Sizes | Reference images |
| --- | --- | --- | --- | --- |
| `google/gemini-3.1-flash-image` (Nano Banana 2) | image + text, chat path | $0.067 at 1K, $0.101 at 2K, $0.151 at 4K | 512, 1K, 2K, 4K; 3:4 at 1K is 896 x 1200 | 14 |
| `google/gemini-3.1-flash-lite-image` | image + text, chat path | $0.034 at 1K | 1K only | not checked |
| `bytedance-seed/seedream-4.5` | image, Images API | $0.04 | 1K, 2K, 4K | 14 |
| `qwen/qwen-image-3` | image, Images API | $0.03 | 1K, 2K | 3 |
| `black-forest-labs/flux.2-pro` | image, Images API | $0.03 per megapixel | by aspect ratio | 8 |
| `openai/gpt-image-1-mini` | image, Images API | token billed, quality dependent | 1:1, 3:2, 2:3 | 16 |

The default for this project is `google/gemini-3.1-flash-image` on the chat path: one provider path
(the chat path the project already uses), reference images, a verified response shape and a known
price. `CANVAS_IMAGE_MODEL` swaps it. Only models that answer on chat completions work with the
first implementation; Images API models would need a second client method.

### Probe result (one call, 2026-11-28)

`google/gemini-3.1-flash-image`, `modalities: ["image","text"]`, 3:4, 1K, one text prompt asking
for a flat navy and gold illustration with no text.

- Latency 60.8 s.
- Cost $0.0665 (1,120 image tokens at $60 per million, plus 31 prompt tokens).
- Output `image/png`, 896 x 1200, about 1.5 MB decoded (2.0 MB base64).
- No text content in the reply; `message.images[0].image_url.url` was a `data:image/png;base64,...`.

One sample says little about the latency distribution. Plan for a range of 10 to 90 s.

## Resolution against the print need

The figure frame is 221 x 310 pt, which is 78 x 109 mm and a 0.713 ratio. At 300 dpi that is about
920 x 1290 px. Gemini's nearest ratio is 3:4 (0.75). A cover-fit crop of an 896 x 1200 image to
that ratio and a resize to 920 x 1290 is a 1.075x upscale: effective about 280 dpi, which prints
cleanly for an illustration. The 2K tier (about 1792 x 2400) is downscaled and is a safe choice if
the quality gate wants more headroom. Cells smaller than the whole frame (2 to 4 figures) need less.
The service validates the final size, and records the real dpi through the existing
`printDpi` rule.

## Content and licensing

- OpenRouter's terms put ownership of the output under each model's own terms ("Your ownership
  rights in the Output are set forth in the Model Terms for each Model you use"), and make the
  customer responsible for checking IP and ownership of inputs and outputs. This comes from a
  third-party tracker quoting the terms; the official terms page was not readable by the fetch
  tool. Someone should read the current terms and the Google terms before turning this on.
- Google states that all generated images carry a SynthID watermark (invisible). Keep it: do not
  strip metadata or re-encode in a way that claims the image is a photograph.
- Providers filter prompts and outputs. Source files can hold anything, so entry text goes into
  prompts. A refusal or empty `images` array is a normal outcome and must be handled as such.
- Prompts leave the project for a third party. Use the same data-handling stance as the text models:
  send only the entry title, intro and category, never source file text or personal data.
- Reference images, if used, are user pictures sent to the provider. Off by default, and the first
  integration does not send any.

## Fit with the evidence rules

Generated images are illustrations, never evidence:

1. **Labelled.** Every generated picture is stored with origin `generated` and shown with a small
   "AI-generated illustration" caption in the figure.
2. **Never cited.** They carry no chunk id, appear in no citation, sources page or claim review, and
   the check service skips them.
3. **Never replace a real picture.** Generation only runs for an entry that has no usable source
   or upload picture, and the figure frame never mixes a generated picture with real ones.
4. **No text in the image**, no logos, people or charts that could pass for data. The prompt says so;
   the model is not trusted to obey, which is one more reason for the label.
5. **Audited.** The model, prompt, cost and latency are stored with the image.
6. **Off by default**, behind `CANVAS_IMAGE_GENERATION=on`.

## Sources

- OpenRouter image generation (Images API): https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- OpenRouter model discovery: https://openrouter.ai/api/v1/models?output_modalities=image and https://openrouter.ai/api/v1/images/models
- OpenRouter per-model endpoint prices: `https://openrouter.ai/api/v1/images/models/<id>/endpoints`
- OpenRouter terms: https://openrouter.ai/terms
- Gemini API pricing and image generation: https://aistudio.google.com/docs/pricing and https://aistudio.google.com/docs/image-generation
- The chat-completions image-output shape was confirmed by the probe, not by the current docs page,
  which now documents the Images API.

## Implementation (off by default)

Flags: `CANVAS_IMAGE_GENERATION=on` and `CANVAS_IMAGE_MODEL` (default
`google/gemini-3.1-flash-image`), declared in `start/env.ts` and `.env.example`.

- `OpenRouterService.generateImage` makes the chat-completions call and returns the bytes, cost and
  latency. It never retries (a call costs money) and has a 150 s deadline.
- `ImageGenerationService` (`app/services/canvas/image_generation_service.ts`) builds the
  Navy/Gold, no-text prompt, calls the provider, validates the picture (a real image, short edge at
  least 640 px, enlarged no more than 1.6x) and fits it to the single-picture figure cell at 300
  dpi (897 x 1266 px) by a cover crop and Lanczos resize. `generateAndStore` registers it as a
  document image with origin `generated`, no source chunk, the caption "AI-generated illustration"
  and a `generation` JSON record (model, prompt, cost, latency, source size, time). Thumb, screen
  and print variants are built exactly as for uploads. Migration
  `1795800000000_alter_document_images_for_generated_origin.ts` widens the origin check and adds
  the column; a check keeps `generation` set exactly for generated rows.
- `PortfolioImagePlanner.illustrate` runs after the entries are written (it needs each page's
  title, intro and category) and before `place`. It only touches entries that have no choice, so a
  source or uploaded picture always wins, and it adds a reviewer note: one on success ("not
  evidence") and one on failure (the frame is left out and the entry page uses the wide layout). A
  provider failure, a refusal or an unusable picture never fails the run. Entries are illustrated
  three at a time.
- The composer (`shared/canvas/portfolio/compose.ts`) prints "AI-generated illustration" in a strip
  along the foot of the figure when a picture is marked `generated`; regeneration of one page
  keeps the mark because it reads the image origin.
- Citations come from page content, and claim review reads cited text blocks, so images never enter
  either. The planner's upload pool is filtered to origin `upload`, so a generated picture is never
  re-used as if the author had supplied it.
- The Postman mock (`postman/mocks/openrouter/default.js`) answers a `modalities` request with a
  synthetic 24 x 32 PNG, and the contract documents the request.

Cost: about $0.07 per entry at the default model. A 10-entry portfolio with no source pictures is
about $0.70 and, three at a time, a few minutes of extra run time.

### Integration note for the AI design pipeline

```ts
import ImageGenerationService, {
  ImageGenerationFailure,
  ILLUSTRATION_LABEL,
} from '#services/canvas/image_generation_service'

if (ImageGenerationService.enabled()) {
  try {
    const image = await new ImageGenerationService().generateAndStore(context, documentId, {
      prompt: ImageGenerationService.illustrationPrompt({ title, intro, category }),
      altText: 'what the picture shows',
      references: [], // optional { bytes, mime }[] for multimodal input
    })
    // image.id is a document image (origin 'generated'); place it as an image frame.
  } catch (error) {
    if (!(error instanceof ImageGenerationFailure)) throw error
    // provider, refused or unusable: leave the frame out and add a reviewer note.
  }
}
```

Rules for callers: call it only where no real source or uploaded picture exists; print
`ILLUSTRATION_LABEL` with the picture (the composer's `PortfolioImage.generated` flag does this for
the portfolio template, and any other layout must do the equivalent); never attach a chunk id or a
citation to it; keep generations off the request path (they take 10 to 90 s); and run them a few at
a time. `PortfolioImagePlanner.illustrate({ context, documentId, pages, choices, guard })` does all
of this for the entries of a portfolio and can be called as it is.
