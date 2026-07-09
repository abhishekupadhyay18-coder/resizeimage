## Changes

### 1. More visible crop rectangle
In `src/components/CropPreview.tsx`:
- Initialize the crop rect to an inset ~10% from each edge (instead of full image) so users immediately see a distinct draggable box in the center.
- Enlarge handles from `h-3 w-3` to `h-4 w-4` (touch: min 16px) with a stronger ring (`ring-2 ring-background shadow-md`) so they're visible on any background.
- Add a subtle white/primary dashed border and a semi-transparent primary tint inside the crop box so the crop area itself stands out against the dimmed overlay.
- Add a rule-of-thirds grid (2 vertical + 2 horizontal thin lines) inside the crop rect for orientation.
- Increase preview max-height from `max-h-64` to `max-h-96` so the working area is larger and easier to interact with.

### 2. Fine-degree rotation slider
In `src/components/CropPreview.tsx`:
- Add a rotation slider (range input) from **-45° to +45°**, step 0.1°, with a numeric readout and a "0°" reset button.
- The slider controls a live *preview* rotation via CSS `transform: rotate()` on the image (no re-encode while dragging — smooth).
- On release (`onPointerUp` / `onChange` commit) or when the user clicks a new **"Apply rotation"** button, call a new prop `onRotateFine(degrees)` which applies the rotation to the bitmap for real (using existing `rotateBitmap`, which already supports arbitrary degrees).
- Existing 90° left/right buttons stay as quick actions and simply set the slider back to 0 after applying.

In `src/components/SectionCard.tsx` and `src/components/AadhaarSection.tsx`:
- Wire the new `onRotateFine` prop to call `rotateBitmap(bitmap, deg)` + `updatePreview` + `runCompress`, same pattern as the existing 90° rotation handler.

### 3. Fix compression failure for larger images (1–5 MB)
Root cause in `src/lib/compress-image.ts` → `compressToRange`:
- The current loop caps at `maxAttempts = 40` and only downscales in 0.85× steps; a 3–5 MB photo often can't reach a strict `< maxKB` in time, so `bestUnder` stays `null` and the function throws / reports "Compression failed" / "Could not land in range".
- The upscale branch (when result is under `minKB`) can loop until attempts exhaust without ever returning.

Fixes:
- **Always return the best encode attempted**, even if strictly-in-range failed. Track `bestOverall` = the encode closest to the `[minBytes, maxBytes]` midpoint across all attempts; return it if no in-range result is found. The UI already handles "closest result" messaging.
- **Faster convergence for big files**: at the start, compute an initial scale from source pixel count so a ~5 MB / very large image starts near a sensible resolution (e.g. cap starting dimension so `width * height * 3` bytes at q=0.8 is roughly within `maxBytes * 20`). This slashes wasted iterations.
- **Raise `maxAttempts` to 80** and use more aggressive downscale (0.75×) when even the lowest tested quality overshoots.
- Ensure the encode helper never leaves `bestOverall` unset — seed it on the first successful `toBlob`.
- Guard the input file size in `SectionCard.tsx` / `AadhaarSection.tsx`: accept up to **10 MB**; show a friendly error above that instead of silently failing.

## Files
- edit `src/components/CropPreview.tsx` — visible crop rect defaults + styling + rotation slider UI.
- edit `src/components/SectionCard.tsx` — wire `onRotateFine`, size guard.
- edit `src/components/AadhaarSection.tsx` — wire `onRotateFine`, size guard.
- edit `src/lib/compress-image.ts` — robust `compressToRange` that always returns best-effort result and handles multi-MB inputs.

No new dependencies.
