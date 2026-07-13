## Home hub

`src/routes/index.tsx` — swap `ToolCard` layout from horizontal rectangles to a **square tile grid** (2 cols mobile, 3 cols ≥sm). Each tile: large icon centered top, title, one-line blurb, fixed `aspect-square`. Reorder:

1. Document Image Compressor → `/tools/compress`
2. Image Tools → `/tools/image`
3. PDF Tools → `/tools/pdf`
4. File Converter → `/tools/convert`
5. **PDF Maker (new)** → `/tools/pdf-maker`

`ToolCard.tsx` rewritten to square variant (keep same props).

## New: PDF Maker (`/tools/pdf-maker`)

Client-only doc-scanner-style flow. All processing on device (canvas + `pdf-lib`).

Flow:
- Capture panel: live camera (`getUserMedia`, rear camera preferred) with a big **Capture** button + **Add from file** fallback (multi-select).
- Captured shots appear in an ordered **thumbnail strip** (drag-to-reorder, delete, retake). Serial order = PDF page order.
- Per-shot editor (opens on tap): crop rectangle (reuses `CropPreview` logic), 90° rotate, and **Enhance mode** selector:
  - Auto Enhance (default): grayscale-world white balance + auto contrast stretch + mild unsharp mask
  - Magic Color: saturation boost + white-balance + contrast stretch
  - Black & White: adaptive threshold (Sauvola-style on downscaled luminance) for crisp scan look
  - Grayscale: luminance only
  - Original: no filter
- Global controls: page size (A4 / Letter / Fit-to-image), margin toggle, filename.
- **Generate PDF** → `pdf-lib` embeds each processed JPEG in order → download.

New files:
- `src/routes/tools.pdf-maker.tsx`
- `src/components/pdfmaker/CameraCapture.tsx` (reuse existing `CameraCapture.tsx` if compatible; wrap otherwise)
- `src/components/pdfmaker/PageStrip.tsx` (thumbnails + reorder + delete)
- `src/components/pdfmaker/PageEditor.tsx` (crop + rotate + enhance preview)
- `src/lib/image-enhance.ts` (auto-contrast, white balance, adaptive threshold, unsharp)

Route registered in `src/routeTree.gen.ts`.

## PDF Tools redesign (`/tools/pdf`)

Two-state layout:

**State A — no file:**
```text
┌───────────────────────────┬─────────────────┐
│  Big drop zone            │  ┌──┐┌──┐┌──┐  │
│  (drag/drop + click)      │  │Mg││Or││Sp│  │
│  left, ~2/3 width         │  └──┘└──┘└──┘  │
│                           │  Merge / Organize / Split │
│                           │  Extract / Delete / Add   │
│                           │  Flip / Rotate            │
└───────────────────────────┴─────────────────┘
```
Right column: small square icon-only tiles (title under icon) for **Merge, Organize Pages, Split, Extract Pages, Delete Pages, Add Pages, Flip, Rotate**. Clicking a tile with no file focuses the drop zone.

**State B — file loaded:**
- Left: page grid rendered with `pdfjs-dist` (all pages visible, selectable, drag-to-reorder for Organize).
- Right: same tile column, now active; selecting a tile reveals its inline action bar above the page grid (e.g., Rotate → 90/180/270 buttons acting on selected pages; Delete → deletes selected; Split → range input; Add Pages → file picker to append; Merge → picker for additional PDFs to append; Extract → export selected).

Files:
- `src/routes/tools.pdf.tsx` — rewritten around this two-state layout
- `src/components/pdf/PdfWorkspace.tsx` (left grid + selection state)
- `src/components/pdf/PdfToolRail.tsx` (right icon tiles)
- `src/components/pdf/actions/*` (one small component per action bar)
- `src/lib/pdf-utils.ts` — add `renderPdfThumbnails(file, scale)` helper and `addPagesToPdf`, `flipPdf` helpers.

## File Converter (`/tools/convert`)

- **Image → Image:** accept `image/*` (JPG, PNG, WEBP, GIF, BMP, TIFF-where-browser-supports, AVIF, HEIC-via-browser-decode when available); output selector includes **JPEG**, PNG, WEBP. Fall back to canvas decode; show clear message if a source type can't be decoded in-browser.
- **Image → PDF:** accept any `image/*` (same broad set).
- **PDF → Image:** output selector adds **JPEG** alongside PNG (already partly there via `pdf-utils.pdfToImages` — expose the `format` control in the UI).

Files touched:
- `src/components/converters/ImageFormatConverter.tsx` — widen `accept`, add JPEG output.
- `src/components/converters/ImagesToPdf.tsx` — widen `accept`.
- `src/components/converters/PdfToImages.tsx` — add JPEG/PNG toggle.

## Image Tools (`/tools/image`)

- **Merge Resize + Crop + Rotate + Degree Rotation + Flip** into one tile: **"Transform"** (single editor with tabs or stacked controls; single Apply commits resize → rotate → flip → crop).
- Add a new tile **"Crop, Edit & Rotate"** modeled on the Document Image Compressor flow:
  - Upload area (drag/drop) **+ live camera capture** button.
  - Once an image is loaded, the same-page editor shows: crop rect, fine-degree rotate slider, 90° buttons, flip, and Save/Download. Mirrors the compressor's per-image UX.
- Remaining tiles stay: Compress, Convert, Add Text, Blur, Sharpen, Brightness/Contrast, Color Adjustments, Denoise.

Files:
- `src/routes/tools.image.tsx` — reorganize tile list.
- `src/components/image/Transform.tsx` (new, merged tool)
- `src/components/image/CropEditRotate.tsx` (new, upload + camera + editor)
- Remove/retire individual `Resize.tsx`, `Rotate.tsx`, `Flip.tsx` tiles (logic folded into Transform).

## Constraints

- 100% client-side. No server calls added.
- Camera uses `navigator.mediaDevices.getUserMedia` with graceful fallback to file input on unsupported browsers.
- All enhancements implemented in `src/lib/image-enhance.ts` using ImageData math (no WASM).

## New deps

None — `pdf-lib` and `pdfjs-dist` already installed.
