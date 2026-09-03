# PDF tools upgrade plan

## Goal
Turn Card 3 into a fast, clear PDF workspace for page-level operations, then activate the existing PDF Editor and PDF Compressor cards with practical local-only workflows.

## User-facing changes

1. **PDF Tools page operations**
   - Show compact rotate and delete icon buttons on every page thumbnail, positioned in the upper corner and usable without selecting the page first.
   - Keep page selection for batch actions and add visible left/right move controls below every thumbnail for manual reordering, alongside drag-and-drop.
   - Combine the current merge/add flows into one **“Merge PDF / Add pages”** tool. Support selecting multiple PDFs and image files in one picker, show the selected items/pages, preserve their order, and append them into the working document.
   - Add a split range field supporting ranges such as `1-3, 5-7`, validate it against the loaded page count, and download one PDF per requested range.
   - Add extract output choices for JPG, PNG, DOCX, and PDF. Require at least one selected page and show a clear message when extraction is attempted without a selection. PDF output remains native; image outputs render selected pages; DOCX uses a compatible document export path or a clearly scoped fallback if browser-only support cannot preserve page fidelity.
   - Show an immediate loading state as soon as a PDF is dropped or selected, keep the page area stable while parsing/rendering, render thumbnails progressively where practical, and surface actionable errors for unsupported/oversized files.

2. **PDF Editor card**
   - Add the missing `/tools/pdf-editor` route so the home card is usable.
   - Provide PDF upload, page thumbnails/navigation, text insertion with font family/size/color/alignment controls, image insertion, add-page, delete/rotate, and a save/download flow.
   - Keep edits local and make the active page and editing controls visually obvious without obscuring the document.

3. **PDF Compressor card**
   - Add the missing `/tools/pdf-compress` route so the home card is usable.
   - Provide PDF upload, target-size choices (50 KB, 100 KB, 200 KB, 500 KB, 1 MB, 2 MB), a quality/clarity preview summary, compression progress, and a best-effort output that never claims a target was met when it was not.
   - Preserve readable text and page order, and clearly report the resulting size and any minimum achievable size.

## Technical approach

- Extend the existing page model in `src/routes/tools.pdf.tsx` with reusable per-page actions, manual move helpers, range parsing, extract format state, and a single multi-file merge/add pipeline.
- Extend `src/lib/pdf-utils.ts` with selected-page rendering and image-to-PDF helpers so extraction and previews do not render unnecessary pages. Keep browser-only PDF rendering dynamically imported.
- Create `src/routes/tools.pdf-editor.tsx` and `src/routes/tools.pdf-compress.tsx`; update route-generated types automatically through the TanStack Router plugin rather than editing `src/routeTree.gen.ts`.
- Reuse the existing `ToolShell`, semantic design tokens, `pdf-lib`, `pdfjs-dist`, and download helpers. Avoid backend work and keep files on-device.
- Add route-specific head metadata for both new routes and preserve the existing PDF Tools route metadata.

## Validation

- Check the current build signal after implementation, then verify the PDF Tools, Editor, and Compressor routes in the live preview.
- Exercise: large-file loading feedback; per-page rotate/delete; left/right reorder; multi-PDF and image merge selection; split ranges; empty extract selection; each supported extract format; editor save; compressor target reporting.
- Confirm no route links point to missing files, no stale imports remain, and no runtime or console errors appear.
