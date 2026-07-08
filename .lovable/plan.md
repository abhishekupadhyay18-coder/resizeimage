## Goal

Remove the global "Auto-crop sensitivity" slider and replace auto-cropping with a **manual, live crop tool** on each uploaded image (Passport, Ghosna Patra, Aadhaar front, Aadhaar back).

## UX

- After upload, the image preview becomes an interactive crop area:
  - A draggable/resizable rectangle overlays the image.
  - Corner + edge handles to resize; drag inside to move.
  - Live dimmed overlay outside the selection.
- Below the preview:
  - **Apply crop** — bakes the selection into the working bitmap and re-runs compression.
  - **Reset** — restores the original uploaded bitmap.
  - Existing **Rotate Left / Right** and **Remove** buttons stay.
- Auto-crop button and the sensitivity slider are removed entirely.

## Files to change

1. **`src/routes/index.tsx`**
   - Delete the sensitivity slider card and `cropSensitivity` state.
   - Stop passing `cropSensitivity` to `SectionCard` / `AadhaarSection`.

2. **`src/lib/compress-image.ts`**
   - Remove `autoCropBitmap` (or leave unexported, unused).
   - Add `cropBitmap(bmp, rect)` helper that returns a new `ImageBitmap` for a normalized rect `{x, y, w, h}` in pixel coords.

3. **`src/components/CropPreview.tsx`** (new)
   - Replaces `RotatablePreview` responsibilities for the preview area.
   - Renders the image inside a relatively-positioned box with an SVG/absolute-div overlay for the crop rectangle.
   - Pointer-event handlers for drag-move and 8 resize handles, clamped to image bounds; works with mouse + touch.
   - Props: `url`, `label?`, `naturalWidth`, `naturalHeight`, `onApplyCrop(rect)`, `onReset`, `onRotateLeft`, `onRotateRight`, `onClear?`, `disabled?`.
   - Rect stored in natural-pixel coordinates; converted to CSS via the rendered image's bounding rect.

4. **`src/components/SectionCard.tsx`**
   - Remove `cropSensitivity` prop and all `autoCropBitmap` calls (initial upload keeps the raw bitmap; store an `originalBitmap` for Reset).
   - Swap `RotatablePreview` → `CropPreview`; wire `onApplyCrop` to `cropBitmap` + re-compress, `onReset` to restore original + re-compress.

5. **`src/components/AadhaarSection.tsx`**
   - Same treatment for front and back slots: remove sensitivity/auto-crop, store originals per side, use `CropPreview`, apply/reset per side. Merge + compress step unchanged.

6. **`src/components/RotatablePreview.tsx`**
   - Delete (no longer referenced) — or keep as a thin re-export if needed; plan is to delete.

## Technical notes

- Coordinate system: keep the crop rect in **natural image pixels**; recompute display rect from `img.getBoundingClientRect()` on each render/resize so it stays aligned when the image is responsive.
- Use `pointerdown` / `pointermove` / `pointerup` with `setPointerCapture` for smooth drag on desktop + touch.
- Minimum crop size: 20×20 natural px, clamped inside `[0, naturalWidth] × [0, naturalHeight]`.
- Initial rect: full image (so "Apply crop" without adjustment is a no-op).
- Rotating the bitmap resets the crop rect to full-image of the new dimensions.
