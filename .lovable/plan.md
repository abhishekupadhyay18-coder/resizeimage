## Home layout

`src/routes/index.tsx` becomes a Tools Hub with **4 cards** in this order:

1. **Document Image Compressor** — the existing flow (Image under 50 KB, Image under 100 KB, Aadhaar merge & compress). Wrapped as-is into `/tools/compress`.
2. **File Converter** — `/tools/convert`
3. **PDF Tools** — `/tools/pdf`
4. **Image Tools** — `/tools/image`

Each card is a `ToolCard` (icon + title + short blurb) that links to its route. Each sub-route shows a grid of service tiles; clicking a tile opens that service inline (single-page tabs) so we don't create a route per micro-tool.

Shared UI: `ToolCard.tsx`, `ServiceTile.tsx`, `ToolShell.tsx` (back link + heading).

## Service coverage (client-only)

Anything requiring a server (LibreOffice / headless conversion / OCR / ghostscript-grade PDF compression) is **omitted per your instruction**. Omissions are called out below so you know why they're missing.

### File Converter (`/tools/convert`)
Included:
- JPG → PNG
- PNG → JPG
- WEBP → JPG (and WEBP → PNG for free)
- PDF → Image (per-page PNG/JPG, zipped when multi-page) — via `pdfjs-dist`
- Image → PDF — via `pdf-lib`

Omitted (need server):
- Word → PDF, Excel → PDF, PPT → PDF, PDF → Word, PDF → Excel

Implementation: one unified converter component with a source-type picker; JPG/PNG/WEBP conversions use `<canvas>` + `toBlob`.

### PDF Tools (`/tools/pdf`)
All via `pdf-lib` (client-only):
- Merge PDF
- Split PDF (by page ranges)
- Rotate PDF (per-page or all)
- Delete Pages
- Extract Pages
- Reorder Pages (drag-to-reorder thumbnails; thumbnails rendered with `pdfjs-dist`)

Omitted:
- **Compress PDF** — quality-preserving PDF compression needs ghostscript / server tooling. Removed per your rule.

### Image Tools (`/tools/image`)
All canvas-based, client-only:
- Resize (px or %)
- Crop (reuses `CropPreview`)
- Rotate (free-angle + 90° steps)
- Flip (horizontal / vertical)
- Compress (JPEG quality slider, optional target-KB reuse of `compressToRange`)
- Convert (format switcher: JPG / PNG / WEBP)
- Add Text (overlay with font/size/color/position)
- Blur (canvas `filter: blur()`)
- Sharpen (3×3 convolution)
- Brightness / Contrast (canvas filter)
- Color Adjustments (hue-rotate, saturation)
- Denoise (simple 3×3 median filter — basic client-side)

## Rotate + Crop rework (carried from previous plan)
`CropPreview.tsx` becomes a single editor: fine-rotate slider + 90° buttons + draggable crop rect all previewed together, one **Apply** button commits `rotate → crop` to the parent via `onApplyEdit({ rotationDeg, cropRect })`. `SectionCard.tsx` and `AadhaarSection.tsx` swap per-op handlers for this unified callback.

## DPI
Default DPI is **300** on first render (already the case) and stays 300 until the user changes it. Existing behavior kept.

## Files

New:
- `src/routes/tools.compress.tsx` — hosts existing Document Image Compressor UI
- `src/routes/tools.convert.tsx`
- `src/routes/tools.pdf.tsx`
- `src/routes/tools.image.tsx`
- `src/components/ToolCard.tsx`
- `src/components/ServiceTile.tsx`
- `src/components/ToolShell.tsx`
- `src/components/converters/*` (ImageFormatConverter, PdfToImages, ImagesToPdf)
- `src/components/pdf/*` (MergePdf, SplitPdf, RotatePdf, DeletePages, ExtractPages, ReorderPages)
- `src/components/image/*` (Resize, Crop, Rotate, Flip, Compress, Convert, AddText, Blur, Sharpen, BrightnessContrast, ColorAdjust, Denoise)
- `src/lib/pdf-utils.ts` (pdf-lib helpers)
- `src/lib/image-filters.ts` (convolution, median, brightness helpers)

Edit:
- `src/routes/index.tsx` — becomes 4-card hub
- `src/components/CropPreview.tsx` — unified rotate+crop editor
- `src/components/SectionCard.tsx` — `onApplyEdit` unified callback
- `src/components/AadhaarSection.tsx` — same

New deps: `pdf-lib`, `pdfjs-dist`.

## Layout sketch

```text
/                 → 4 ToolCards
/tools/compress   → existing compressor (unchanged behavior)
/tools/convert    → tile grid → inline converter panels
/tools/pdf        → tile grid → inline PDF tool panels
/tools/image      → tile grid → inline image tool panels
```
