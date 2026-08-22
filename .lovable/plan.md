# Camera focus, sharper compression, clean rotation, and an Image Tools rework

## Part 1 — Camera focus (every card with live capture)

The camera viewfinder is shared by all tools, so one change covers every card.

- Tap anywhere on the video to focus there; an animated focus ring appears at the tap point.
- Real hardware focus where supported (continuous autofocus by default, single-shot focus on tap, focus point of interest when exposed); a graceful visual-only fallback elsewhere.
- Capture waits briefly after a focus tap so the frame settles, and requests the highest resolution the camera offers.

## Part 2 — Document Image Compressor (card 1)

- Keep the strict KB windows (40–45 KB, 90–95 KB) but improve clarity: stepped downscaling instead of one big jump, adaptive post-resize sharpening, light level cleanup for crisp document text, and preference for keeping resolution high while trading quality first.
- Rotation without black corners: after a fine rotation the image auto-crops to the largest rectangle fully inside the rotated frame, exactly like rotating a photo in a phone gallery. The live preview shows that same result while dragging the slider, and rotation + crop still commit with one Apply.

## Part 3 — Image Tools (card 2)

### Tool rail changes
- Merge Crop, Rotate and Compress into a single first tool: "Crop, Rotate & Compress".
- Remove the Sharpen tool (sharpness moves into Brightness/Contrast).
- Remove "Blur all"; blur becomes area-based only.
- Convert gains a PDF output option (single image to PDF, sized to the image).

### Add text
- One click adds a text box onto the image; the caret starts blinking immediately for typing.
- Each box gets a small handle badge at its top-right corner used for dragging/moving; other corners resize.
- Click an existing box to keep editing and appending words.
- Per-text controls: font family, size, weight/italic/underline, colour, opacity, alignment, letter spacing, background/outline, rotation, duplicate, delete.
- A panel on the right lists all text layers in order (Text 1, Text 2, …) so the count is visible; selecting a row selects that box on the image, with reorder and delete from the list.

### Brightness / Contrast
- Add a sharpness slider alongside brightness, contrast, exposure and highlights, with a stronger enhancement curve for maximum clarity.

### Colour
- Remove the Apply button — sliders act live.
- Values start at defaults and stay wherever the user set them, persisting when switching to another tool and back.

### Blur
- Lower the intensity range so the default is subtle.
- Brush/region blur: user paints or drags a region over the image and only that area is blurred, with adjustable brush size and strength.

### Denoise
- Stronger, better denoise: strength slider, edge-preserving smoothing so detail and text edges survive, and an optional detail-recovery pass.

### Compress
- Add a DPI selector (72/150/300/600 plus custom, default 300) written into the exported file, next to the existing target-size presets.

## Technical notes

- `src/components/CameraCapture.tsx`: tap-to-focus overlay, `applyConstraints` with `focusMode`/`pointsOfInterest` guarded by `getCapabilities()`, `width/height: { ideal: 4096 }`, settle delay before `toBlob`.
- `src/lib/compress-image.ts`: stepped-halving resize, unsharp-mask pass (reusing `convolve3x3` from `image-filters.ts`), new `rotateBitmapCropped()` computing the inscribed rectangle; wire into `compressToRange`/`compressBelow` and `setJpegDpi`.
- `src/components/CropPreview.tsx`: preview clips to the inscribed rect while `rotate(deg)` is applied; single rotation-then-crop commit.
- `src/routes/tools.image.tsx`: rework `TOOLS` (merge `cropedit`+`transform`-crop+`compress`, drop `sharpen`), lift colour/bright slider state to the page so it persists, add DPI to `CompressPanel`, add PDF to `ConvertPanel` (pdf-lib, already a dependency).
- `src/components/image/TextLayer.tsx`: contentEditable boxes with corner move-badge, selection state shared with a new layers list panel; text styling state per layer.
- New `src/lib/image-filters.ts` additions: region blur compositing via mask canvas, bilateral-style denoise.
