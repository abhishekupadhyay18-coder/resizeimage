## Changes

### 1. Rename section titles and download filenames
In `src/routes/index.tsx`:
- Passport Size Photograph → **"Image under 50 KB"**, base filename `image50`.
- Ghosna Patra → **"Image under 100 KB"**, base filename `image100`.
- Keep existing KB targets (40–45 KB and 90–95 KB).

In `src/components/AadhaarSection.tsx`:
- Heading → **"Merge and compress"**, base filename `merged`.

`SectionCard`'s `downloadName` prop becomes `downloadBase` (base name without extension); the extension is chosen by the format selector below. `AadhaarSection` follows the same pattern.

### 2. Download format selector (JPG / PNG / JPEG)
- Add a small format selector above the Download button in both `SectionCard.tsx` and `AadhaarSection.tsx`. Three radio-style pill buttons: **JPG** (default), **PNG**, **JPEG**.
- Behavior:
  - **JPG** and **JPEG** — reuse the already-compressed JPEG blob (they're the same format; only the extension differs → `image50.jpg` vs `image50.jpeg`). File size stays in the target KB range.
  - **PNG** — re-encode the current bitmap to PNG via `canvas.toBlob(..., "image/png")` in a new helper `encodePng(bitmap)` in `src/lib/compress-image.ts`. PNG is lossless so the file will typically be larger than the KB target; show a small helper note ("PNG is lossless — file may exceed the KB target.").
- The download link's `download` attribute uses `${downloadBase}.${ext}` and `href` points at the currently selected format's blob URL. Blob URLs for each format are created on demand and revoked on unmount / new file.

### 3. Live camera capture (still photo)
Create `src/components/CameraCapture.tsx` — a modal that:
- Opens `navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false })` and shows a live `<video>` viewfinder (not recording).
- **Capture** draws the current video frame to a canvas once, converts to a JPEG `Blob` via `canvas.toBlob(..., "image/jpeg", 0.95)`, wraps in a `File`, calls `onCapture(file)`, and stops all tracks.
- **Switch camera** toggles `facingMode` between `"environment"` and `"user"`.
- **Cancel** / unmount stops all tracks.
- Friendly error if permission denied or `mediaDevices` unavailable.

Wire into every upload slot in `SectionCard.tsx` and `AadhaarSection.tsx`:
- Empty state: add **"Use camera"** button next to the drag/drop label.
- Loaded state: small **"Retake"** button in the crop toolbar.
- Captured `File` flows through the existing `handleFile` / `setSide` path.

### 4. Crop handles start at the image corners
In `src/components/CropPreview.tsx`:
- Change `initialRect()` to return the full image bounds (`x:0, y:0, w:naturalWidth, h:naturalHeight`) so the four corner handles sit exactly on the image corners on first render.
- Keep the "Apply crop" button disabled until the user actually drags a handle (existing `cropChanged` guard).
- Keep the rule-of-thirds grid, dashed border, and larger handles from the previous change.

### 5. DPI option for "Image under 50 KB"
Add DPI as JPEG metadata (does not resample or change file size — only affects how print software sizes the image on paper; shown as helper text).
- In `src/lib/compress-image.ts`: add `setJpegDpi(blob: Blob, dpi: number): Promise<Blob>` that rewrites the JFIF APP0 marker's `Xdensity` / `Ydensity` bytes (units=1, inches). Pure byte edit.
- In `SectionCard.tsx`: add a `dpi?: boolean` prop. When true, show a DPI control above the Download button — numeric input (default 300, range 72–1200) with quick presets **72 / 150 / 300 / 600**. On change, re-tag the current compressed JPEG blob and refresh the download link.
- DPI applies to JPG/JPEG downloads only; PNG uses its own `pHYs` chunk which is out of scope — a note will say "DPI applies to JPG/JPEG only."
- In `src/routes/index.tsx`: pass `dpi` only to the "Image under 50 KB" section.

## Files
- new `src/components/CameraCapture.tsx` — live viewfinder + still-photo capture, returns a JPEG `File`.
- edit `src/components/CropPreview.tsx` — initial crop rect = full image so corner handles sit on the corners.
- edit `src/components/SectionCard.tsx` — camera button, retake, format selector, DPI control (when `dpi` prop set), `downloadBase` prop.
- edit `src/components/AadhaarSection.tsx` — camera button per side, renamed heading, format selector, `merged` base filename.
- edit `src/lib/compress-image.ts` — `setJpegDpi` and `encodePng` helpers.
- edit `src/routes/index.tsx` — new titles, `downloadBase` values (`image50`, `image100`), `dpi` prop on first section.

No new dependencies.
