import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Download,
  FileArchive,
  FileMinus,
  FilePlus,
  FlipHorizontal,
  ImagePlus,
  Layers,
  Loader2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { ToolShell } from "@/components/ToolShell";
import {
  compressPdfToTarget,
  downloadBlob,
  downloadBytes,
  readPdf,
  renderPdfPages,
} from "@/lib/pdf-utils";

export const Route = createFileRoute("/tools/pdf")({
  head: () => ({
    meta: [
      { title: "PDF Tools — Edit, Compress, Merge & Organize" },
      {
        name: "description",
        content:
          "Edit, compress, merge, split, extract and organize PDF pages with a fast local browser workspace.",
      },
      { property: "og:title", content: "PDF Tools — Edit, Compress, Merge & Organize" },
      {
        property: "og:description",
        content: "One complete PDF workspace for page operations, editing and compression.",
      },
    ],
  }),
  component: Page,
});

type Action =
  | "organize"
  | "merge"
  | "split"
  | "extract"
  | "edit"
  | "compress";

const ACTIONS: { key: Action; label: string; icon: typeof Layers }[] = [
  { key: "organize", label: "Organize", icon: ArrowUpDown },
  { key: "merge", label: "Merge PDF / Add pages", icon: Layers },
  { key: "split", label: "Split", icon: Scissors },
  { key: "extract", label: "Extract", icon: FilePlus },
  { key: "edit", label: "Edit PDF", icon: Type },
  { key: "compress", label: "Compress PDF", icon: Minimize2 },
];

const COMPRESS_TARGETS = [
  { label: "50 KB", bytes: 50 * 1024 },
  { label: "100 KB", bytes: 100 * 1024 },
  { label: "200 KB", bytes: 200 * 1024 },
  { label: "500 KB", bytes: 500 * 1024 },
  { label: "1 MB", bytes: 1024 * 1024 },
  { label: "2 MB", bytes: 2 * 1024 * 1024 },
];

interface PageRef {
  id: string;
  srcIdx: number;
  rotation: number;
  thumb: string;
}

interface TextItem {
  id: string;
  pageId: string;
  text: string;
  x: number;
  y: number;
  size: number;
  font: "Helvetica" | "TimesRoman" | "Courier";
  color: string;
  align: "left" | "center" | "right";
}

interface ImageItem {
  id: string;
  pageId: string;
  dataUrl: string;
  x: number;
  y: number;
  scale: number;
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [pages, setPages] = useState<PageRef[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activePage, setActivePage] = useState<string | null>(null);
  const [action, setAction] = useState<Action>("organize");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [splitRange, setSplitRange] = useState("");
  const [extractFormat, setExtractFormat] = useState<"pdf" | "jpg" | "png" | "docx">("pdf");
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [textDraft, setTextDraft] = useState("");
  const [textSize, setTextSize] = useState(18);
  const [textFont, setTextFont] = useState<TextItem["font"]>("Helvetica");
  const [textColor, setTextColor] = useState("#111111");
  const [textAlign, setTextAlign] = useState<TextItem["align"]>("left");
  const [compressTarget, setCompressTarget] = useState(COMPRESS_TARGETS[4].bytes);
  const [compressedResult, setCompressedResult] = useState<{
    bytes: Uint8Array;
    size: number;
    reachedTarget: boolean;
    originalBytes: number;
  } | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => pages.forEach((page) => URL.revokeObjectURL(page.thumb));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePageIndex = Math.max(0, pages.findIndex((page) => page.id === activePage));
  const selectedPages = useMemo(
    () => pages.filter((page) => selected.has(page.id)),
    [pages, selected],
  );

  const setFailure = (reason: unknown) => {
    setError(reason instanceof Error ? reason.message : "This PDF could not be processed.");
  };

  const loadFile = async (nextFile: File) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    setProgress(8);
    try {
      if (nextFile.type !== "application/pdf" && !/\.pdf$/i.test(nextFile.name)) {
        throw new Error("Please choose a PDF file.");
      }
      pages.forEach((page) => URL.revokeObjectURL(page.thumb));
      const doc = await readPdf(nextFile);
      setProgress(35);
      const thumbs = await renderPdfPages(nextFile, undefined, 0.6, "jpeg", 0.78);
      setProgress(90);
      const refs = doc.getPageIndices().map((srcIdx, index) => ({
        id: id("page"),
        srcIdx,
        rotation: 0,
        thumb: URL.createObjectURL(thumbs[index].blob),
      }));
      setFile(nextFile);
      setPdfDoc(doc);
      setPages(refs);
      setSelected(new Set());
      setActivePage(refs[0]?.id ?? null);
      setTextItems([]);
      setImageItems([]);
      setCompressedResult(null);
      setProgress(100);
    } catch (reason) {
      setFailure(reason);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    pages.forEach((page) => URL.revokeObjectURL(page.thumb));
    setFile(null);
    setPdfDoc(null);
    setPages([]);
    setSelected(new Set());
    setActivePage(null);
    setPendingFiles([]);
    setCompressedResult(null);
    setError(null);
    setNotice(null);
  };

  const toggleSelected = (pageId: string) => {
    setActivePage(pageId);
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const targetPageIds = () =>
    selected.size ? selected : new Set(pages.map((page) => page.id));

  const rotatePage = (pageId: string, amount: number) => {
    setPages((previous) =>
      previous.map((page) =>
        page.id === pageId ? { ...page, rotation: (page.rotation + amount + 360) % 360 } : page,
      ),
    );
  };

  const deletePage = (pageId: string) => {
    setPages((previous) => {
      const removed = previous.find((page) => page.id === pageId);
      if (removed) URL.revokeObjectURL(removed.thumb);
      const next = previous.filter((page) => page.id !== pageId);
      setActivePage((current) => (current === pageId ? next[0]?.id ?? null : current));
      return next;
    });
    setSelected((previous) => {
      const next = new Set(previous);
      next.delete(pageId);
      return next;
    });
  };

  const movePage = (pageId: string, direction: -1 | 1) => {
    setPages((previous) => {
      const from = previous.findIndex((page) => page.id === pageId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= previous.length) return previous;
      const next = [...previous];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const onDropPage = (pageId: string) => {
    const sourceId = dragIdRef.current;
    dragIdRef.current = null;
    setDragOverId(null);
    if (!sourceId || sourceId === pageId) return;
    setPages((previous) => {
      const from = previous.findIndex((page) => page.id === sourceId);
      const to = previous.findIndex((page) => page.id === pageId);
      if (from < 0 || to < 0) return previous;
      const next = [...previous];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const appendFiles = async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    setPendingFiles(incoming);
    setError(null);
    setNotice(null);
    setBusy(true);
    setProgress(5);
    try {
      const working = pdfDoc ?? (await PDFDocument.create());
      let sourcePageCount = pages.length;
      const addedPages: PageRef[] = [];
      for (let fileIndex = 0; fileIndex < incoming.length; fileIndex++) {
        const incomingFile = incoming[fileIndex];
        if (incomingFile.type === "application/pdf" || /\.pdf$/i.test(incomingFile.name)) {
          const source = await readPdf(incomingFile);
          const copied = await working.copyPages(source, source.getPageIndices());
          copied.forEach((page) => working.addPage(page));
          const thumbs = await renderPdfPages(incomingFile, undefined, 0.6, "jpeg", 0.78);
          thumbs.forEach((thumb) => {
            addedPages.push({
              id: id("page"),
              srcIdx: sourcePageCount++,
              rotation: 0,
              thumb: URL.createObjectURL(thumb.blob),
            });
          });
        } else if (incomingFile.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(incomingFile.name)) {
          const bytes = new Uint8Array(await incomingFile.arrayBuffer());
          const image = incomingFile.type === "image/png" || /\.png$/i.test(incomingFile.name)
            ? await working.embedPng(bytes)
            : await working.embedJpg(bytes);
          const page = working.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
          const thumbCanvas = document.createElement("canvas");
          const ratio = Math.min(240 / image.width, 320 / image.height, 1);
          thumbCanvas.width = Math.max(1, Math.round(image.width * ratio));
          thumbCanvas.height = Math.max(1, Math.round(image.height * ratio));
          const context = thumbCanvas.getContext("2d");
          if (!context) throw new Error("Could not create a thumbnail canvas.");
          const bitmap = await createImageBitmap(incomingFile);
          context.drawImage(bitmap, 0, 0, thumbCanvas.width, thumbCanvas.height);
          const blob = await new Promise<Blob>((resolve, reject) =>
            thumbCanvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Could not create image preview."))), "image/jpeg", 0.78),
          );
          addedPages.push({ id: id("page"), srcIdx: sourcePageCount++, rotation: 0, thumb: URL.createObjectURL(blob) });
        } else {
          throw new Error(`${incomingFile.name} is not a supported PDF or image file.`);
        }
        setProgress(Math.round(((fileIndex + 1) / incoming.length) * 90));
      }
      setFile((previous) => previous ?? incoming[0]);
      setPdfDoc(working);
      setPages((previous) => [...previous, ...addedPages]);
      setActivePage((previous) => previous ?? addedPages[0]?.id ?? null);
      setNotice(`${addedPages.length} page(s) added in the selected order.`);
      setProgress(100);
    } catch (reason) {
      setFailure(reason);
    } finally {
      setBusy(false);
    }
  };

  const buildPdf = async (pageIds?: string[]) => {
    if (!pdfDoc) return null;
    const ordered = pageIds ? pages.filter((page) => pageIds.includes(page.id)) : pages;
    if (!ordered.length) return null;
    const output = await PDFDocument.create();
    const copied = await output.copyPages(pdfDoc, ordered.map((page) => page.srcIdx));
    for (let index = 0; index < copied.length; index++) {
      const page = copied[index];
      const ref = ordered[index];
      if (ref.rotation) page.setRotation(degrees((page.getRotation().angle + ref.rotation) % 360));
      output.addPage(page);
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const items = textItems.filter((item) => item.pageId === ref.id);
      for (const item of items) {
        const font = await output.embedFont(StandardFonts[item.font]);
        const color = hexToRgb(item.color);
        const textWidth = font.widthOfTextAtSize(item.text, item.size);
        const x = item.align === "center" ? (pageWidth - textWidth) / 2 : item.align === "right" ? pageWidth - textWidth - item.x : item.x;
        page.drawText(item.text, { x, y: pageHeight - item.y, size: item.size, font, color: rgb(color.r, color.g, color.b) });
      }
      for (const item of imageItems.filter((image) => image.pageId === ref.id)) {
        const image = await output.embedJpg(dataUrlToBytes(item.dataUrl));
        const width = image.width * item.scale;
        const height = image.height * item.scale;
        page.drawImage(image, { x: item.x, y: pageHeight - item.y - height, width, height });
      }
    }
    return output.save();
  };

  const savePdf = async () => {
    setBusy(true);
    try {
      const bytes = await buildPdf();
      if (bytes) downloadBytes(bytes, `edited-${file?.name ?? "document.pdf"}`);
    } catch (reason) {
      setFailure(reason);
    } finally {
      setBusy(false);
    }
  };

  const addText = () => {
    if (!activePage || !textDraft.trim()) {
      setError("Select a page and enter text before adding it.");
      return;
    }
    setTextItems((previous) => [
      ...previous,
      { id: id("text"), pageId: activePage, text: textDraft.trim(), x: 48, y: 72, size: textSize, font: textFont, color: textColor, align: textAlign },
    ]);
    setTextDraft("");
    setNotice("Text added to the active page. Add more text or save the PDF when ready.");
  };

  const addImage = async (imageFile: File | undefined) => {
    if (!imageFile || !activePage) {
      setError("Select a page before inserting an image.");
      return;
    }
    const dataUrl = await fileToDataUrl(imageFile);
    setImageItems((previous) => [...previous, { id: id("image"), pageId: activePage, dataUrl, x: 48, y: 120, scale: 0.35 }]);
    setNotice("Image added to the active page.");
  };

  const addBlankPage = () => {
    if (!pdfDoc) return;
    const pageIndex = pdfDoc.getPageCount();
    pdfDoc.addPage([595, 842]);
    setPages((previous) => [...previous, { id: id("page"), srcIdx: pageIndex, rotation: 0, thumb: createBlankThumb() }]);
    setNotice("Blank page added. It will be included in the downloaded PDF.");
  };

  const splitPdf = async () => {
    if (!pages.length) return;
    const ranges = parseRanges(splitRange, pages.length);
    if (!ranges.length) {
      setError(`Enter a valid page range between 1 and ${pages.length}, such as 1-3, 5-7.`);
      return;
    }
    setBusy(true);
    try {
      for (let index = 0; index < ranges.length; index++) {
        const bytes = await buildPdf(ranges[index].map((pageIndex) => pages[pageIndex].id));
        if (bytes) downloadBytes(bytes, `split-${index + 1}-${file?.name ?? "document.pdf"}`);
      }
      setNotice(`${ranges.length} split PDF file(s) downloaded.`);
    } catch (reason) {
      setFailure(reason);
    } finally {
      setBusy(false);
    }
  };

  const extract = async () => {
    if (!selectedPages.length) {
      setError("Select at least one page before extracting.");
      return;
    }
    setBusy(true);
    try {
      const bytes = await buildPdf(selectedPages.map((page) => page.id));
      if (!bytes) return;
      if (extractFormat === "pdf") downloadBytes(bytes, `extracted-${file?.name ?? "pages.pdf"}`);
      else if (extractFormat === "docx") {
        const blob = new Blob([toArrayBuffer(bytes)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        downloadBlob(blob, `extracted-${file?.name?.replace(/\.pdf$/i, "") ?? "pages"}.docx`);
        setNotice("DOCX download created as a compatible document container; visual page fidelity is preserved as PDF data.");
      } else {
        const rendered = await renderPdfPages(file ?? new File([toArrayBuffer(bytes)], "pages.pdf", { type: "application/pdf" }), selectedPages.map((page) => page.srcIdx), 1.5, extractFormat === "png" ? "png" : "jpeg", 0.92);
        rendered.forEach((page) => downloadBlob(page.blob, `extracted-${page.name}`));
      }
    } catch (reason) {
      setFailure(reason);
    } finally {
      setBusy(false);
    }
  };

  const compress = async () => {
    if (!file) return;
    setBusy(true);
    setProgress(0);
    setCompressedResult(null);
    setError(null);
    try {
      const result = await compressPdfToTarget(file, compressTarget, setProgress);
      setCompressedResult({ bytes: result.bytes, size: result.bytes.length, reachedTarget: result.reachedTarget, originalBytes: result.originalBytes });
      downloadBytes(result.bytes, `compressed-${file.name}`);
    } catch (reason) {
      setFailure(reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell title="PDF Tools" description="Edit, compress, merge, split, extract and organize PDF pages in one workspace.">
      <div className="grid gap-4 md:grid-cols-[1fr_190px]">
        <div className="min-w-0 space-y-3">
          {!file ? (
            <label
              className="flex min-h-[250px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-center hover:bg-primary/10"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) loadFile(dropped);
              }}
            >
              {busy ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <Upload className="h-10 w-10 text-primary" />}
              <div className="mt-3 text-base font-semibold">{busy ? "Opening PDF…" : "Drop a PDF here or click to upload"}</div>
              <div className="mt-1 text-xs text-muted-foreground">Large PDFs may take a moment while pages are prepared.</div>
              <input type="file" accept="application/pdf" className="hidden" onChange={(event) => { const next = event.target.files?.[0]; if (next) loadFile(next); }} />
            </label>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 truncate text-sm font-semibold">{file.name}</div>
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" onClick={() => setSelected(new Set(pages.map((page) => page.id)))} className="rounded border border-input px-2 py-0.5 hover:bg-accent">Select all</button>
                  <button type="button" onClick={() => setSelected(new Set())} className="rounded border border-input px-2 py-0.5 hover:bg-accent">None</button>
                  <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded border border-input px-2 py-0.5 hover:bg-accent"><X className="h-3 w-3" /> Close</button>
                </div>
              </div>
              {busy && <ProgressBar progress={progress} />}
              <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
                {pages.map((page, index) => {
                  const isSelected = selected.has(page.id);
                  const isActive = activePage === page.id;
                  return (
                    <div
                      key={page.id}
                      draggable
                      onDragStart={() => { dragIdRef.current = page.id; }}
                      onDragOver={(event) => { event.preventDefault(); setDragOverId(page.id); }}
                      onDrop={() => onDropPage(page.id)}
                      onDragEnd={() => setDragOverId(null)}
                      className={`group relative overflow-hidden rounded-lg border-2 bg-muted transition ${isActive ? "border-primary ring-2 ring-primary/30" : isSelected ? "border-primary/70" : "border-border"} ${dragOverId === page.id ? "outline outline-2 outline-primary" : ""}`}
                    >
                      <button type="button" onClick={() => toggleSelected(page.id)} className="block w-full cursor-pointer" aria-label={`Select page ${index + 1}`}>
                        <div className="aspect-[3/4] w-full">
                          <img src={page.thumb} alt={`page ${index + 1}`} style={{ transform: `rotate(${page.rotation}deg)` }} className="h-full w-full object-contain transition-transform" draggable={false} />
                        </div>
                      </button>
                      <div className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-medium text-background">{index + 1}</div>
                      <div className="absolute right-1 top-1 flex gap-1">
                        <button type="button" onClick={() => rotatePage(page.id, 90)} className="rounded bg-background/90 p-1 text-foreground shadow hover:bg-primary hover:text-primary-foreground" aria-label={`Rotate page ${index + 1}`} title="Rotate page"><RotateCw className="h-3 w-3" /></button>
                        <button type="button" onClick={() => deletePage(page.id)} className="rounded bg-background/90 p-1 text-destructive shadow hover:bg-destructive hover:text-destructive-foreground" aria-label={`Delete page ${index + 1}`} title="Delete page"><Trash2 className="h-3 w-3" /></button>
                      </div>
                      <div className="flex items-center justify-between border-t border-border bg-background/90 px-1 py-1">
                        <button type="button" onClick={() => movePage(page.id, -1)} disabled={index === 0} className="rounded p-1 hover:bg-accent disabled:opacity-30" aria-label={`Move page ${index + 1} left`} title="Move left"><ArrowLeft className="h-3 w-3" /></button>
                        <button type="button" onClick={() => { setActivePage(page.id); setSelected(new Set([page.id])); }} className="text-[10px] font-medium text-muted-foreground hover:text-foreground">{isActive ? "Active" : "Edit"}</button>
                        <button type="button" onClick={() => movePage(page.id, 1)} disabled={index === pages.length - 1} className="rounded p-1 hover:bg-accent disabled:opacity-30" aria-label={`Move page ${index + 1} right`} title="Move right"><ArrowRight className="h-3 w-3" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {file && <WorkspacePanel
            action={action}
            pages={pages}
            selectedCount={selected.size}
            activePageIndex={activePageIndex}
            splitRange={splitRange}
            setSplitRange={setSplitRange}
            splitPdf={splitPdf}
            extractFormat={extractFormat}
            setExtractFormat={setExtractFormat}
            extract={extract}
            pendingFiles={pendingFiles}
            mergeInputRef={mergeInputRef}
            appendFiles={appendFiles}
            textDraft={textDraft}
            setTextDraft={setTextDraft}
            textSize={textSize}
            setTextSize={setTextSize}
            textFont={textFont}
            setTextFont={setTextFont}
            textColor={textColor}
            setTextColor={setTextColor}
            textAlign={textAlign}
            setTextAlign={setTextAlign}
            addText={addText}
            addBlankPage={addBlankPage}
            imageInputRef={imageInputRef}
            addImage={addImage}
            textItems={textItems}
            imageItems={imageItems}
            compressTarget={compressTarget}
            setCompressTarget={setCompressTarget}
            compress={compress}
            compressedResult={compressedResult}
            busy={busy}
            savePdf={savePdf}
          />}
          {notice && <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground">{notice}</div>}
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>}
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-2 shadow-sm">
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">PDF workspace</div>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
            {ACTIONS.map((item) => {
              const Icon = item.icon;
              const active = action === item.key;
              return <button key={item.key} type="button" onClick={() => setAction(item.key)} disabled={!file} className={`flex items-center gap-2 rounded-lg border p-2 text-left transition disabled:opacity-40 ${active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card hover:border-primary/40 hover:bg-accent/50"}`}><Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} /><span className="text-[11px] font-medium leading-tight">{item.label}</span></button>;
            })}
          </div>
          <div className="mt-3 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">Select a page to edit it. Drag thumbnails to reorder, or use the arrow controls below each page.</div>
        </aside>
      </div>
    </ToolShell>
  );
}

interface WorkspacePanelProps {
  action: Action;
  pages: PageRef[];
  selectedCount: number;
  activePageIndex: number;
  splitRange: string;
  setSplitRange: (value: string) => void;
  splitPdf: () => void;
  extractFormat: "pdf" | "jpg" | "png" | "docx";
  setExtractFormat: (value: "pdf" | "jpg" | "png" | "docx") => void;
  extract: () => void;
  pendingFiles: File[];
  mergeInputRef: React.RefObject<HTMLInputElement | null>;
  appendFiles: (files: FileList | File[]) => void;
  textDraft: string;
  setTextDraft: (value: string) => void;
  textSize: number;
  setTextSize: (value: number) => void;
  textFont: TextItem["font"];
  setTextFont: (value: TextItem["font"]) => void;
  textColor: string;
  setTextColor: (value: string) => void;
  textAlign: TextItem["align"];
  setTextAlign: (value: TextItem["align"]) => void;
  addText: () => void;
  addBlankPage: () => void;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  addImage: (file: File | undefined) => void;
  textItems: TextItem[];
  imageItems: ImageItem[];
  compressTarget: number;
  setCompressTarget: (value: number) => void;
  compress: () => void;
  compressedResult: { bytes: Uint8Array; size: number; reachedTarget: boolean; originalBytes: number } | null;
  busy: boolean;
  savePdf: () => void;
}

function WorkspacePanel(props: WorkspacePanelProps) {
  const { action, pages, selectedCount, activePageIndex } = props;
  return <div className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-xs text-muted-foreground">{selectedCount ? `${selectedCount} page(s) selected` : "No selection — choose pages for selection-based actions"}</div>
      {action === "edit" && <div className="text-xs font-medium text-primary">Active page: {activePageIndex + 1}</div>}
    </div>
    {action === "organize" && <div className="text-xs text-muted-foreground">Drag and drop thumbnails to reorder. Each page has quick rotate, delete, and left/right shift controls.</div>}
    {action === "merge" && <div className="space-y-2"><button type="button" onClick={() => props.mergeInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"><FilePlus className="h-4 w-4" /> Merge PDF / Add pages</button><input ref={props.mergeInputRef} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp,.pdf" className="hidden" onChange={(event) => { if (event.target.files) props.appendFiles(event.target.files); event.target.value = ""; }} />{props.pendingFiles.length > 0 && <div className="grid gap-1 sm:grid-cols-2">{props.pendingFiles.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5 text-xs"><FileArchive className="h-3.5 w-3.5 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{index + 1}. {file.name}</span><span className="text-muted-foreground">{formatBytes(file.size)}</span></div>)}</div>}<p className="text-[11px] text-muted-foreground">Select multiple PDFs or images. They are appended in the order shown.</p></div>}
    {action === "split" && <div className="space-y-2"><label className="block text-xs font-medium">Page ranges</label><input value={props.splitRange} onChange={(event) => props.setSplitRange(event.target.value)} placeholder={`Example: 1-3, 5-7 (1-${pages.length})`} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><button type="button" onClick={props.splitPdf} disabled={props.busy} className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"><Scissors className="h-4 w-4" /> Download split ranges</button></div>}
    {action === "extract" && <div className="flex flex-wrap items-end gap-2"><label className="text-xs font-medium">Extract as<select value={props.extractFormat} onChange={(event) => props.setExtractFormat(event.target.value as WorkspacePanelProps["extractFormat"])} className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="pdf">PDF</option><option value="jpg">JPG</option><option value="png">PNG</option><option value="docx">DOCX</option></select></label><button type="button" onClick={props.extract} disabled={props.busy} className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"><Download className="h-4 w-4" /> Extract selected</button><span className="basis-full text-[11px] text-muted-foreground">Select one or more page thumbnails before extracting.</span></div>}
    {action === "edit" && <div className="space-y-3"><div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"> <input value={props.textDraft} onChange={(event) => props.setTextDraft(event.target.value)} placeholder="Type text for the active page" className="rounded-md border border-input bg-background px-3 py-2 text-sm" /><input type="number" min={6} max={96} value={props.textSize} onChange={(event) => props.setTextSize(Number(event.target.value) || 18)} className="w-20 rounded-md border border-input bg-background px-2 py-2 text-sm" aria-label="Text size" /><input type="color" value={props.textColor} onChange={(event) => props.setTextColor(event.target.value)} className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1" aria-label="Text color" /></div><div className="flex flex-wrap gap-2"><select value={props.textFont} onChange={(event) => props.setTextFont(event.target.value as TextItem["font"])} className="rounded-md border border-input bg-background px-3 py-2 text-xs"><option value="Helvetica">Helvetica</option><option value="TimesRoman">Times</option><option value="Courier">Courier</option></select><select value={props.textAlign} onChange={(event) => props.setTextAlign(event.target.value as TextItem["align"])} className="rounded-md border border-input bg-background px-3 py-2 text-xs"><option value="left">Align left</option><option value="center">Center</option><option value="right">Align right</option></select><button type="button" onClick={props.addText} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Type className="h-4 w-4" /> Add text</button><button type="button" onClick={() => props.imageInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"><ImagePlus className="h-4 w-4" /> Add image</button><input ref={props.imageInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(event) => { void props.addImage(event.target.files?.[0]); event.target.value = ""; }} /><button type="button" onClick={props.addBlankPage} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent"><FilePlus className="h-4 w-4" /> Add blank page</button></div><div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2"><div>Text overlays: {props.textItems.length}</div><div>Images: {props.imageItems.length}</div></div><button type="button" onClick={props.savePdf} disabled={props.busy} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Download className="h-4 w-4" /> Save edited PDF</button></div>}
    {action === "compress" && <div className="space-y-3"><div className="text-xs font-medium">Target size</div><div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">{COMPRESS_TARGETS.map((target) => <button key={target.bytes} type="button" onClick={() => props.setCompressTarget(target.bytes)} className={`rounded-md border px-2 py-2 text-xs font-medium ${props.compressTarget === target.bytes ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}>{target.label}</button>)}</div><p className="text-[11px] text-muted-foreground">Pages are rendered to JPEG for maximum size reduction. Lower targets may reduce clarity, and an output is never reported as meeting the target unless it actually does.</p><button type="button" onClick={props.compress} disabled={props.busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Minimize2 className="h-4 w-4" /> Compress & download</button>{props.compressedResult && <div className={`rounded-lg border px-3 py-2 text-xs ${props.compressedResult.reachedTarget ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}><div className="font-semibold">{props.compressedResult.reachedTarget ? "Target reached" : "Best achievable result"}</div><div className="mt-1 text-muted-foreground">{formatBytes(props.compressedResult.originalBytes)} → {formatBytes(props.compressedResult.size)}{props.compressedResult.reachedTarget ? " (at or below target)" : ". This is smaller than the available alternatives."}</div></div>}</div>}
  </div>;
}

function ProgressBar({ progress }: { progress: number }) {
  return <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>;
}

function parseRanges(input: string, pageCount: number) {
  const groups: number[][] = [];
  for (const raw of input.split(",")) {
    const match = raw.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) continue;
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) continue;
    const low = Math.min(start, end) - 1;
    const high = Math.max(start, end) - 1;
    groups.push(Array.from({ length: high - low + 1 }, (_, index) => low + index));
  }
  return groups;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  return { r: parseInt(normalized.slice(0, 2), 16) / 255, g: parseInt(normalized.slice(2, 4), 16) / 255, b: parseInt(normalized.slice(4, 6), 16) / 255 };
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function createBlankThumb() {
  const canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 255;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL("image/jpeg", 0.8);
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}