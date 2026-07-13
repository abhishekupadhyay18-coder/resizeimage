import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Download,
  FileMinus,
  FilePlus,
  FlipHorizontal,
  Layers,
  Loader2,
  RotateCw,
  Scissors,
  Trash2,
  Upload,
  X,
  Undo2,
} from "lucide-react";
import { PDFDocument, degrees } from "pdf-lib";
import { ToolShell } from "@/components/ToolShell";
import { downloadBytes, readPdf } from "@/lib/pdf-utils";

export const Route = createFileRoute("/tools/pdf")({
  head: () => ({
    meta: [
      { title: "PDF Tools — Merge, Split, Rotate, Organize" },
      {
        name: "description",
        content: "Merge, split, rotate, delete, extract, reorder and flip PDF pages — all in your browser.",
      },
      { property: "og:title", content: "PDF Tools" },
      { property: "og:description", content: "Client-side PDF editor with page thumbnails and quick actions." },
    ],
  }),
  component: Page,
});

type Action =
  | "merge"
  | "organize"
  | "split"
  | "extract"
  | "delete"
  | "add"
  | "flip"
  | "rotate";

const ACTIONS: { key: Action; label: string; icon: typeof Layers }[] = [
  { key: "merge", label: "Merge PDF", icon: Layers },
  { key: "organize", label: "Organize", icon: ArrowUpDown },
  { key: "split", label: "Split", icon: Scissors },
  { key: "extract", label: "Extract", icon: FilePlus },
  { key: "delete", label: "Delete", icon: FileMinus },
  { key: "add", label: "Add Pages", icon: FilePlus },
  { key: "flip", label: "Flip", icon: FlipHorizontal },
  { key: "rotate", label: "Rotate", icon: RotateCw },
];

interface PageRef {
  id: string;
  srcIdx: number; // index into pdfDoc
  rotation: number; // additive rotation degrees
  flipped: boolean; // 180 marker (pdf-lib flip requires custom, so we treat as 180 rotate)
  thumb: string;
}

function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [pages, setPages] = useState<PageRef[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<Action>("organize");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      pages.forEach((p) => URL.revokeObjectURL(p.thumb));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFile = async (f: File) => {
    setError(null);
    setBusy(true);
    try {
      pages.forEach((p) => URL.revokeObjectURL(p.thumb));
      const doc = await readPdf(f);
      const thumbs = await renderThumbs(f);
      const refs: PageRef[] = doc.getPageIndices().map((i) => ({
        id: `p-${i}-${Math.random().toString(36).slice(2, 6)}`,
        srcIdx: i,
        rotation: 0,
        flipped: false,
        thumb: thumbs[i],
      }));
      setFile(f);
      setPdfDoc(doc);
      setPages(refs);
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    pages.forEach((p) => URL.revokeObjectURL(p.thumb));
    setFile(null);
    setPdfDoc(null);
    setPages([]);
    setSelected(new Set());
    setError(null);
  };

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelected(new Set(pages.map((p) => p.id)));
  const selectNone = () => setSelected(new Set());
  const targetIds = () =>
    selected.size ? pages.filter((p) => selected.has(p.id)).map((p) => p.id) : pages.map((p) => p.id);

  const rotateSel = (deg: number) => {
    const ids = new Set(targetIds());
    setPages((prev) =>
      prev.map((p) => (ids.has(p.id) ? { ...p, rotation: (p.rotation + deg) % 360 } : p)),
    );
  };
  const flipSel = () => {
    const ids = new Set(targetIds());
    setPages((prev) =>
      prev.map((p) =>
        ids.has(p.id) ? { ...p, rotation: (p.rotation + 180) % 360, flipped: !p.flipped } : p,
      ),
    );
  };
  const deleteSel = () => {
    if (!selected.size) return;
    setPages((prev) => {
      prev.forEach((p) => {
        if (selected.has(p.id)) URL.revokeObjectURL(p.thumb);
      });
      return prev.filter((p) => !selected.has(p.id));
    });
    setSelected(new Set());
  };

  const onDragStart = (id: string) => (dragIdRef.current = id);
  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const onDrop = (id: string) => {
    const src = dragIdRef.current;
    dragIdRef.current = null;
    setDragOverId(null);
    if (!src || src === id) return;
    setPages((prev) => {
      const arr = [...prev];
      const from = arr.findIndex((p) => p.id === src);
      const to = arr.findIndex((p) => p.id === id);
      if (from < 0 || to < 0) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const appendPdf = async (f: File) => {
    setBusy(true);
    try {
      if (!pdfDoc) return;
      const src = await readPdf(f);
      const startIdx = pdfDoc.getPageCount();
      const copied = await pdfDoc.copyPages(src, src.getPageIndices());
      copied.forEach((p) => pdfDoc.addPage(p));
      const thumbs = await renderThumbs(f);
      const newRefs: PageRef[] = thumbs.map((thumb, i) => ({
        id: `p-${startIdx + i}-${Math.random().toString(36).slice(2, 6)}`,
        srcIdx: startIdx + i,
        rotation: 0,
        flipped: false,
        thumb,
      }));
      setPages((prev) => [...prev, ...newRefs]);
    } finally {
      setBusy(false);
    }
  };

  const build = async (indicesOverride?: string[]): Promise<Uint8Array | null> => {
    if (!pdfDoc) return null;
    const ordered = indicesOverride
      ? pages.filter((p) => indicesOverride.includes(p.id))
      : pages;
    if (!ordered.length) return null;
    const out = await PDFDocument.create();
    const copied = await out.copyPages(
      pdfDoc,
      ordered.map((p) => p.srcIdx),
    );
    copied.forEach((page, i) => {
      const ref = ordered[i];
      if (ref.rotation) {
        const cur = page.getRotation().angle;
        page.setRotation(degrees((cur + ref.rotation) % 360));
      }
      out.addPage(page);
    });
    return await out.save();
  };

  const download = async () => {
    setBusy(true);
    try {
      const bytes = await build();
      if (bytes) downloadBytes(bytes, `edited-${file?.name ?? "output.pdf"}`);
    } finally {
      setBusy(false);
    }
  };

  const extractSelected = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      const ids = pages.filter((p) => selected.has(p.id)).map((p) => p.id);
      const bytes = await build(ids);
      if (bytes) downloadBytes(bytes, `extracted-${file?.name ?? "output.pdf"}`);
    } finally {
      setBusy(false);
    }
  };

  const splitEach = async () => {
    if (!pdfDoc || !pages.length) return;
    setBusy(true);
    try {
      for (let i = 0; i < pages.length; i++) {
        const bytes = await build([pages[i].id]);
        if (bytes) {
          await new Promise((r) => setTimeout(r, 120 * i));
          downloadBytes(bytes, `page-${i + 1}-${file?.name ?? "output.pdf"}`);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      title="PDF Tools"
      description="Upload a PDF, then organize, rotate, split, extract or delete pages."
    >
      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
        {/* LEFT: file / pages */}
        <div className="space-y-3">
          {!file ? (
            <label
              className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-center hover:bg-primary/10"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) loadFile(f);
              }}
            >
              <Upload className="h-10 w-10 text-primary" />
              <div className="mt-3 text-base font-semibold">Drop a PDF here or click to upload</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Then pick a tool from the right to organize, rotate, split & more.
              </div>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadFile(f);
                }}
              />
            </label>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold truncate">{file.name}</div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="rounded border border-input px-2 py-0.5 hover:bg-accent"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={selectNone}
                    className="rounded border border-input px-2 py-0.5 hover:bg-accent"
                  >
                    None
                  </button>
                  <button
                    type="button"
                    onClick={clear}
                    className="inline-flex items-center gap-1 rounded border border-input px-2 py-0.5 hover:bg-accent"
                  >
                    <X className="h-3 w-3" /> Close
                  </button>
                </div>
              </div>
              <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
                {pages.map((p, i) => {
                  const sel = selected.has(p.id);
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => onDragStart(p.id)}
                      onDragOver={(e) => onDragOver(e, p.id)}
                      onDrop={() => onDrop(p.id)}
                      onDragEnd={() => setDragOverId(null)}
                      onClick={() => toggleSel(p.id)}
                      className={`group relative cursor-pointer overflow-hidden rounded-lg border-2 bg-muted transition ${
                        sel ? "border-primary ring-2 ring-primary/30" : "border-border"
                      } ${dragOverId === p.id ? "outline outline-2 outline-primary/50" : ""}`}
                    >
                      <div className="aspect-[3/4] w-full">
                        <img
                          src={p.thumb}
                          alt={`page ${i + 1}`}
                          style={{ transform: `rotate(${p.rotation}deg)` }}
                          className="h-full w-full object-contain transition-transform"
                          draggable={false}
                        />
                      </div>
                      <div className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {i + 1}
                      </div>
                      {sel && (
                        <div className="absolute right-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {file && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-2">
              <div className="text-xs text-muted-foreground">
                {selected.size
                  ? `${selected.size} page(s) selected`
                  : "No selection — actions apply to all pages"}
              </div>
              <ActionBar
                action={action}
                onRotate={rotateSel}
                onFlip={flipSel}
                onDelete={deleteSel}
                onExtract={extractSelected}
                onSplitEach={splitEach}
                onAdd={appendPdf}
                onUndoRotate={() => {
                  const ids = new Set(targetIds());
                  setPages((prev) =>
                    prev.map((p) => (ids.has(p.id) ? { ...p, rotation: 0, flipped: false } : p)),
                  );
                }}
              />
              <button
                type="button"
                onClick={download}
                disabled={busy || !pages.length}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Save & download PDF
              </button>
            </div>
          )}

          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>

        {/* RIGHT: tools rail */}
        <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
          <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tools
          </div>
          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              const active = action === a.key;
              const disabled = !file && a.key !== "merge";
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAction(a.key)}
                  disabled={disabled}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition disabled:opacity-40 ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card hover:border-primary/40 hover:bg-accent/50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-[11px] font-medium leading-tight">{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </ToolShell>
  );
}

function ActionBar({
  action,
  onRotate,
  onFlip,
  onDelete,
  onExtract,
  onSplitEach,
  onAdd,
  onUndoRotate,
}: {
  action: Action;
  onRotate: (deg: number) => void;
  onFlip: () => void;
  onDelete: () => void;
  onExtract: () => void;
  onSplitEach: () => void;
  onAdd: (f: File) => void;
  onUndoRotate: () => void;
}) {
  if (action === "rotate") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">Rotate:</span>
        {[90, 180, 270].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onRotate(d)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            {d}°
          </button>
        ))}
        <button
          type="button"
          onClick={onUndoRotate}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Undo2 className="h-3 w-3" /> Reset
        </button>
      </div>
    );
  }
  if (action === "flip") {
    return (
      <button
        type="button"
        onClick={onFlip}
        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        <FlipHorizontal className="h-3.5 w-3.5" /> Flip page(s) 180°
      </button>
    );
  }
  if (action === "delete") {
    return (
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete selected
      </button>
    );
  }
  if (action === "extract") {
    return (
      <button
        type="button"
        onClick={onExtract}
        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        <FilePlus className="h-3.5 w-3.5" /> Extract selected as PDF
      </button>
    );
  }
  if (action === "split") {
    return (
      <button
        type="button"
        onClick={onSplitEach}
        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        <Scissors className="h-3.5 w-3.5" /> Split every page → separate PDFs
      </button>
    );
  }
  if (action === "add" || action === "merge") {
    return (
      <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
        <FilePlus className="h-3.5 w-3.5" />
        {action === "merge" ? "Append another PDF (merge)" : "Add pages from another PDF"}
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onAdd(f);
            e.target.value = "";
          }}
        />
      </label>
    );
  }
  // organize
  return (
    <div className="text-xs text-muted-foreground">
      Drag &amp; drop thumbnails to reorder. Click to select pages.
    </div>
  );
}

async function renderThumbs(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  // @ts-ignore
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const urls: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 0.6 });
    const c = document.createElement("canvas");
    c.width = viewport.width;
    c.height = viewport.height;
    const ctx = c.getContext("2d")!;
    // @ts-ignore
    await page.render({ canvasContext: ctx, viewport, canvas: c }).promise;
    const blob = await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.8),
    );
    urls.push(URL.createObjectURL(blob));
  }
  return urls;
}
