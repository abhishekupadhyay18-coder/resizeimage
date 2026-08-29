# Fix Image Tools editing, conversion previews, and PDF Maker input

## 1. Image Tools text editing

- Make text input append in normal order by preserving the contentEditable selection/caret while text changes, rather than replacing the DOM selection on every keystroke.
- Replace the current fragile drag behavior with pointer-capture handlers that use functional state updates and keep the selected text layer stable during movement.
- Make the move badge a reliable top-right drag handle and make the resize handle respond consistently to pointer/touch movement, with sensible bounds and a larger hit area.
- Keep text layers after applying them. Applying will commit the current text styling to the working image while retaining an editable layer state/reference so the user can reopen, select, edit, move, resize, or append to existing text instead of losing the edit controls.
- Ensure clicking an existing text box focuses its caret and clicking the move/resize controls never inserts text.

## 2. Image Tools enhancements and mobile layout

- Remove Denoise from the Image Tools rail and remove its active panel/imports so it is no longer available.
- Add three clear Brightness / Contrast presets, such as Photograph, Study Document, and Balanced, each updating the existing live adjustment values and remaining editable through the sliders.
- Keep the current single working image, but reorganize the editor responsively: image/content remains on the left on larger screens, the compact tool rail remains on the right, and the selected tool’s controls render in a full-width area beneath the image rather than inside the right rail.
- Add two-finger pan/scroll handling to the image workspace without breaking one-finger text selection, dragging, crop handles, or normal page scrolling.
- Preserve the existing undo/redo, live colour sliders, crop/rotate/compress flow, and filter preview behavior while changing only the requested layout and interactions.

## 3. Conversion controls

- Add DPI selection to image conversion outputs with presets including 72, 150, 300 (default), and 600 DPI plus a validated custom value; write DPI metadata for JPEG output without changing image pixels or dimensions.
- Add PDF output sizing controls (Fit image, A4, and Letter) and keep image-to-PDF output predictable while preserving the selected image dimensions/aspect ratio inside the chosen page.
- Apply the same relevant controls to the File Converter surfaces so image conversion and image-to-PDF conversion do not expose different capabilities unexpectedly.

## 4. File Converter previews and editing

- Image to PDF: store selected files as reorderable items, show thumbnail, filename, and size for every selected image, and provide remove, rotate, and a crop action for each item before export.
- Implement per-image crop editing with the existing crop preview behavior and commit the adjusted bitmap back to that item; preserve item order in the resulting PDF.
- PDF to Image: support multiple selected PDFs, show a preview/summary for every selected PDF (thumbnail/first-page preview where available, filename, size, and page count), allow removal, and convert all remaining PDFs using the chosen output format and quality settings.
- Add loading/progress feedback while PDF previews/pages are being read so large files do not appear unresponsive.

## 5. PDF Maker PDF input

- Allow PDF files in the PDF Maker input alongside image files.
- Read imported PDF pages and include them in the page list in their original order, with thumbnails and existing reorder/delete/edit affordances where compatible.
- Keep image-page enhancement and crop/rotate editing intact; PDF-origin pages should remain usable and be copied into the final PDF without rasterizing unless an edit requires a rasterized page.
- Ensure object URLs/document resources are released when pages are removed or the tool is reset.

## Technical implementation details

- Update `src/components/image/TextLayer.tsx` for selection-safe content editing, pointer-capture movement/resizing, and stable layer references.
- Update `src/routes/tools.image.tsx` for persistent applied text state, removal of Denoise, enhancement presets, the below-image controls layout, two-finger workspace gestures, and conversion DPI/PDF-size controls.
- Update `src/routes/tools.convert.tsx` with multi-item image/PDF state, previews, per-image crop/rotate/remove/reorder actions, PDF page-count loading, DPI, and PDF page-size handling.
- Update `src/routes/tools.pdf-maker.tsx` and supporting PDF/image utilities for PDF input, page previews, and safe resource cleanup. Do not change generated route files.

## Validation

- Verify in the live preview that typed words remain in normal order, text layers drag and resize reliably, applied text can be edited again, and the three enhancement presets visibly update the image.
- Verify Denoise is absent, the responsive image/tools/control layout matches the requested arrangement, and two-finger movement does not trigger accidental page zoom or text edits.
- Verify image conversion keeps dimensions, embeds the selected JPEG DPI, PDF sizing works, image-to-PDF previews show every selected item with crop/rotate actions, and multiple PDF-to-image selections show previews and convert correctly.
- Verify PDF Maker accepts a PDF, displays its pages, preserves page order, and exports a valid final PDF.
- Check the newest build/runtime diagnostics and exercise the affected flows at desktop and the current mobile viewport.