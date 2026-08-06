# Big upgrade pass: UI polish, theming, and tool rework

Everything stays 100% in-browser. No backend added.

## 1. Theme: dark / light / system

- Add a `ThemeToggle` (Sun / Moon / Monitor segmented control) in the header of the home page and in `ToolShell`.
- Theme stored in `localStorage`, applied by toggling the `.dark` class on `<html>`; `system` follows `prefers-color-scheme`. An inline script in the root document prevents a flash on first paint.
- The dark palette already exists in `src/styles.css`; only the switcher and a few contrast tweaks are needed.

## 2. Home page

- Shrink tiles: 3 columns on phones (currently 2), smaller icon (40px), tighter padding, smaller title/blurb. Fixes oversized cards on Android.
- Icon gets an outlined box look: rounded square with a visible border and soft tinted background instead of a solid filled block.
- General polish: subtle gradient header, hover lift, consistent accent tints per tool.

## 3. Document Image Compressor

- Rename the Aadhaar section heading to **Merge and compress (Aadhar)**; the two slots become **Image 1** and **Image 2**.
- New **results bar** that appears once compressed outputs exist in any section:
  - **Download all** (highlighted) — triggers each file individually with its own name (`image50.jpg`, `image100.jpg`, `merged.jpg`); no zip.
  - **Share all** — uses the device share sheet with all files attached (WhatsApp, Mail, etc.). Files are shared as-is, no re-encoding, so quality is untouched. Where the browser can't share files, it falls back to Download all with a short note.

## 4. Image Tools

- **Duplicate preview fix:** the page currently renders a standalone preview image *and* each panel renders its own canvas. The standalone preview is removed so there is exactly one image, and every tool operates on that same canvas.
- **Layout rework:** upload/canvas area on the left, a compact right-side rail of small icon+name tool buttons in a fixed order.
- **Undo / redo** stack over the working bitmap, with buttons in the toolbar (also Reset to original).
- **Add text** becomes direct-on-image: click to place, drag to move, corner handle to resize, click an existing text box to re-edit and append words, plus font family / size / color / bold. Multiple text boxes supported; all baked in on Apply.
- **Enhanced adjustments:** Brightness/Contrast, Sharpen, Colour, Blur, Transform get live preview (adjust and see the result immediately), reset per control, and an Auto-enhance preset.
- **Compress:** preset target chips **20 / 30 / 50 / 100 KB** plus a custom value. The encoder targets the largest size *strictly below* the chosen limit, keeps original pixel dimensions whenever it can hit the target, and only downscales as a last resort — with a clear note when that happens.

## 5. PDF Tools

- **Higher-quality page rendering.** Thumbnails currently render at a low scale, which is why detail looks cut off or missing. Rendering moves to a device-pixel-ratio-aware scale with a larger high-res render when a page is opened, so pages look sharp.
- **Organize** is renamed **Organize Pages (Acrobat style)** and gets per-page hover/tap controls, as in Acrobat:
  - small **✕** at the top-right of each page → delete that page
  - **rotate left / rotate right** icons at the page corners
  - drag-and-drop reordering with a clear insertion indicator
  - Undo, and Save as the single commit point
- **PDF Editor (new tool):** overlay-based editing on top of the existing pages — add text boxes anywhere (choice of standard fonts plus any font file the user loads), place and resize images, draw/highlight, insert blank pages or pages from another PDF, reorder, then **Save PDF** commits everything.
  - Note: editing *existing* text already inside a PDF (re-flowing original paragraphs) is not possible in the browser. The editor covers/overlays and adds content, which handles the common cases (fill in, stamp, annotate, add image, add page).
- **PDF Compressor (new tool):**
  - Re-encodes page content at the best quality that fits, keeping page dimensions.
  - Target picker: **50 KB / 100 KB / 200 KB / 500 KB / 1 MB / 2 MB** plus a free-text box for any size; output is always strictly below the chosen size.
  - Shows before/after size and a quality readout; warns if the target is so small that legibility suffers.

## 6. Overall UI

- Consistent card, header, and button styling across all routes; larger tap targets on mobile; smooth transitions; empty states with helpful hints; toast feedback on every action.
- No change to the existing processing logic beyond what is listed above.

## Technical notes

- New: `src/components/ThemeToggle.tsx`, `src/hooks/use-theme.ts`, `src/components/image/TextLayer.tsx`, `src/components/image/history.ts`, `src/routes/tools.pdf-editor.tsx`, `src/routes/tools.pdf-compress.tsx`, `src/lib/pdf-render.ts`, `src/lib/pdf-compress.ts`, `src/lib/share.ts`.
- Modified: `ToolCard`, `ToolShell`, `src/routes/index.tsx`, `tools.image.tsx`, `tools.pdf.tsx`, `tools.compress.tsx`, `AadhaarSection.tsx`, `SectionCard.tsx`, `pdf-utils.ts`, `compress-image.ts`, `styles.css`.
- Sharing uses `navigator.share` with a `files` payload; download-all loops anchor downloads with a small stagger so browsers don't block them.
- PDF compression rasterises pages with pdfjs at a computed DPI and re-embeds JPEGs via pdf-lib, binary-searching quality/scale to land just under the target.
- No new dependencies.
