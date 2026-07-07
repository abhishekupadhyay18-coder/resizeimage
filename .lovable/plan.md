
## Goal

A single-page tool with three sections that compress user-uploaded images to strict size windows while keeping maximum clarity:

1. **Passport photo** — output strictly `> 40 KB` and `< 45 KB`
2. **Ghosna Patra** — output strictly `> 90 KB` and `< 95 KB`
3. **Aadhaar Card** — two uploads (front + back), merged vertically into one JPG, then compressed to `> 90 KB` and `< 95 KB`

All outputs are JPG. Accepted inputs: JPG, JPEG, PNG, WEBP, any size.

## UX

Landing page (replaces the placeholder in `src/routes/index.tsx`) with a clean, sharp visual style and three stacked cards:

- **Card 1 — Passport Photo**: dropzone / file picker → preview → ⟲ / ⟳ manual rotate buttons → auto-compress → shows final KB in green if in-range → **Download passport.jpg**.
- **Card 2 — Ghosna Patra**: same flow → **Download ghosna-patra.jpg**.
- **Card 3 — Aadhaar Card**: two side-by-side sub-dropzones labelled **Front** and **Back**, each with its own preview + rotate buttons. Once both are uploaded, a **Merge & Compress** action stacks front directly above back (no background, no resizing — front's pixels then back's pixels; if widths differ, back is scaled to match front's width so the stack has a single width), then compresses. **Download aadhaar.jpg**.

Each card shows original size, final size, and a subtle progress indicator during compression. Errors (unsupported type, compression failed to hit range) render inline.

## Compression algorithm (clarity-first)

Shared utility `compressToRange(bitmap, minBytes, maxBytes)`:

1. Decode with `createImageBitmap` (respecting EXIF via `imageOrientation: 'from-image'`).
2. Start at full resolution, JPEG quality binary-searched in `[0.5, 0.98]` to find the highest quality producing `< maxBytes`.
3. If the best result is `≤ minBytes` (image is too small/simple to reach the floor at full res), progressively pad quality upward toward 0.98; if still below floor, up-scale canvas in 1.05× steps until size crosses into the window.
4. If full-res + max quality is still `> maxBytes`, scale canvas down in 0.92× steps and repeat the quality search.
5. Hard cap: 30 encode attempts; on failure surface a clear error.

This keeps resolution as high as possible (sharpness) while landing in the narrow KB band.

## Rotation

- On upload: decode with `imageOrientation: 'from-image'` so EXIF-rotated phone photos come out upright automatically.
- Manual **Rotate Left 90°** and **Rotate Right 90°** buttons on every preview — rotation applied to an offscreen canvas and fed back into the compression step.

## Aadhaar merge (no extras)

- Take front bitmap (post-rotation) and back bitmap (post-rotation).
- Output canvas width = front's width. If back's width differs, back is drawn scaled to that width preserving its aspect ratio (needed because canvases can't have variable row widths).
- Output canvas height = front.height + scaledBack.height.
- Draw front at (0, 0), back at (0, front.height). No padding, no fill.
- Feed merged canvas into `compressToRange(_, 90*1024, 95*1024)`.

## Files

- **New** `src/lib/compress-image.ts` — `loadBitmap(file)`, `rotateBitmap(bitmap, degrees)`, `mergeVertical(top, bottom)`, `compressToRange(bitmap, min, max)` returning `{ blob, sizeKB }`.
- **New** `src/components/SectionCard.tsx` — reusable single-upload section (used by Passport + Ghosna Patra).
- **New** `src/components/AadhaarSection.tsx` — dual upload + merge + compress.
- **New** `src/components/RotatablePreview.tsx` — image preview with ⟲ / ⟳ buttons.
- **Edit** `src/routes/index.tsx` — replace placeholder with the three-section layout.
- **Edit** `src/routes/__root.tsx` — real title/description/OG tags (e.g. "Image Compressor — Passport, Ghosna Patra, Aadhaar").

## Out of scope

- No backend, no storage, no auth (everything runs in the browser).
- No HEIC support, no PDF, no batch upload.
- No cropping or background removal.
