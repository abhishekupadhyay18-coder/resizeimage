# Consolidate PDF features into PDF Tools

## Goal
Remove the standalone PDF Editor and PDF Compressor home cards and make both capabilities available as focused options inside the existing PDF Tools workspace.

## User-facing changes

1. **Simplify the home hub**
   - Remove the PDF Editor and PDF Compressor cards and their unused navigation references.
   - Keep PDF Tools as the single entry point for all PDF page operations and advanced PDF features.

2. **Add PDF Editor inside PDF Tools**
   - Add an “Edit PDF” option to the PDF Tools action rail.
   - Reuse the loaded PDF/page workspace so users can navigate thumbnails, add text with font/size/color/alignment controls, insert images, add pages, rotate/delete pages, and save/download the edited PDF locally.
   - Keep editing controls compact and clearly tied to the active page without hiding page actions.

3. **Add PDF Compressor inside PDF Tools**
   - Add a “Compress PDF” option to the same action rail.
   - Provide target-size choices of 50 KB, 100 KB, 200 KB, 500 KB, 1 MB, and 2 MB, with a clear quality/clarity trade-off summary and progress state.
   - Produce a best-effort compressed download, report the actual output size, and never claim a target was reached when it was not.

## Technical details

- Extend `src/routes/tools.pdf.tsx` with editor and compressor modes rather than creating separate user-facing routes.
- Reuse the existing `pdf-lib`, `pdfjs-dist`, `ToolShell`, semantic tokens, loading states, and download utilities.
- Keep processing browser-only and local; preserve the existing merge, organize, split, extract, rotate, delete, and add-pages flows.
- Keep route-specific PDF Tools metadata and ensure every action has a working visible state.
- Do not edit generated route-tree files; no new standalone PDF Editor or PDF Compressor routes should remain linked or required.

## Validation

- Confirm the home page shows only one PDF Tools card.
- Verify the PDF Tools rail exposes Edit PDF and Compress PDF alongside the existing operations.
- Exercise editor upload/edit/add-page/save and compressor target selection/progress/output reporting.
- Check build/runtime logs and confirm no missing-route links, console errors, or stale imports remain.
