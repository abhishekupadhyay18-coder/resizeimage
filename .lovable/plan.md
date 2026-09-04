# Consolidate PDF Editor and Compressor into PDF Tools

## Goal
Make PDF Tools the single PDF workspace: remove the two standalone home cards and add editor/compressor modes to Card 3 without changing the existing PDF Maker or File Converter cards.

## User-facing changes

1. **Simplify the home screen**
   - Remove the separate PDF Editor and PDF Compressor cards.
   - Update the home metadata and PDF Tools description so users understand that editing and compression are included in the PDF Tools workspace.
   - Remove the now-unused standalone navigation references; no new standalone cards or links will remain.

2. **Complete page operations in PDF Tools**
   - Keep the existing PDF upload/drag-and-drop flow and show a visible loading state while large files are parsed and thumbnails are rendered.
   - Add rotate and delete icon buttons to every page thumbnail’s upper corner.
   - Add left/right move buttons below every thumbnail while preserving drag-and-drop reordering.
   - Replace the separate merge/add actions with one clearly labeled **“Merge PDF / Add pages”** action that accepts multiple PDFs and images, previews the selected inputs, preserves their order, and appends them to the current workspace.
   - Add validated manual split ranges such as `1-3, 5-7`, producing one PDF per requested range.
   - Add Extract format choices for JPG, PNG, DOCX, and PDF; show a clear selection-required message when no page is selected.

3. **Add the editor as a PDF Tools mode**
   - Add an **Edit PDF** option to the PDF Tools rail.
   - Support selecting an active page, inserting and editing text with font family, size, color, and alignment controls, inserting images, adding pages, and saving/downloading the result.
   - Keep page-level rotate/delete and reorder controls available while editing, with a clear active-page state.

4. **Add the compressor as a PDF Tools mode**
   - Add a **Compress PDF** option to the PDF Tools rail.
   - Provide target choices of 50 KB, 100 KB, 200 KB, 500 KB, 1 MB, and 2 MB.
   - Show compression progress, quality/clarity guidance, actual output size, and the minimum achievable size when a target cannot be reached.
   - Never report that a target was met unless the downloaded result is actually at or below that target.

## Technical details

- Extend `src/routes/tools.pdf.tsx` and reusable PDF utilities rather than adding user-facing PDF Editor or PDF Compressor routes.
- Reuse `pdf-lib`, `pdfjs-dist`, semantic design tokens, existing upload/download helpers, and local-only browser processing.
- Keep the generated route tree untouched and preserve the existing PDF Tools route metadata with route-specific editor/compressor wording where appropriate.
- Handle unsupported files, empty selections, parse failures, and oversized/slow PDFs with actionable inline feedback.

## Validation

- Confirm the home screen contains one PDF Tools card and no standalone editor/compressor cards or missing links.
- Verify the PDF Tools workspace exposes Organize, Merge PDF / Add pages, Split, Extract, Edit PDF, and Compress PDF modes.
- Exercise page corner actions, manual and drag reordering, multi-file PDF/image append, range splitting, all extract choices, empty-selection feedback, editor save, and compressor target reporting.
- Check build/runtime logs and live preview behavior for loading states, console errors, and broken downloads.
