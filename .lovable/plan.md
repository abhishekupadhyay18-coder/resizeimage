# Camera focus + sharper compression + clean rotation

## 1. Tap-to-focus in the live camera (all cards)

The camera viewfinder is shared by every tool (compressor, merge, image tools, PDF maker), so one change covers all cards.

- Tap anywhere on the video to focus at that point: a focus ring animates at the tap position.
- Where the device supports it, apply a real camera focus request (continuous autofocus by default, single-shot focus on tap, plus focus distance/points of interest when the camera exposes them).
- Where hardware focus control isn't exposed (most desktops, some browsers), the ring still shows and the camera stays in continuous autofocus so the capture is taken after the picture settles.
- Small extras: capture waits a moment after a focus tap so the frame is sharp, and capture uses the highest resolution the camera offers.

## 2. Maximum clarity after strict compression (Document Image Compressor)

Keep the strict KB windows (40–45 KB, 90–95 KB) exactly as they are, but make the output visibly sharper:

- Downscale in multiple gentle steps instead of one big jump, which avoids the mushy look on large phone photos.
- Apply a light, adaptive sharpening pass after resizing, tuned to how much the image was shrunk (no sharpening when the image kept full size).
- Slight contrast/level cleanup so text on documents stays crisp.
- Prefer keeping resolution high and lowering quality first; only shrink pixels when the size target cannot be met.
- The final encode still lands strictly inside the required KB range.

## 3. Rotation without black corners

Today a fine rotation grows the canvas and fills the new corners with empty/black area.

- After rotating, automatically crop to the largest rectangle fully inside the rotated image (same behaviour as rotating a photo in a phone gallery app) — no black wedges, aspect ratio preserved.
- The live preview shows exactly that result while you drag the rotation slider, so what you see is what Apply produces.
- Rotation and crop still commit together with a single Apply; the crop box maps correctly onto the rotated result.

## Technical notes

- `src/components/CameraCapture.tsx`: add tap-to-focus overlay, `applyConstraints` with `focusMode`/`pointsOfInterest` guarded by `getCapabilities()`, request `width/height: { ideal: 4096 }`, and a short settle delay before `toBlob`.
- `src/lib/compress-image.ts`: replace single-step `drawToCanvas` scaling with stepped halving, add `unsharpMask`-style post-resize sharpening (reuse `convolve3x3` from `src/lib/image-filters.ts`), and wire it into `compressToRange` / `compressBelow`.
- `src/lib/compress-image.ts`: add `rotateBitmapCropped()` computing the inscribed-rectangle crop for an arbitrary angle; use it in `rotateBitmap` callers.
- `src/components/CropPreview.tsx`: preview via a container that clips to the inscribed rect while `rotate(deg)` is applied, and apply rotation-then-crop in one commit.
