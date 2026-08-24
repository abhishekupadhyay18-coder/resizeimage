import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Download,
  Loader2,
  Plus,
  ScanLine,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { ToolShell } from "@/components/ToolShell";
import { CameraCapture } from "@/components/CameraCapture";
import {
  loadBitmap,
  cropBitmap,
  rotateBitmap,
  rotateBitmapCropped,
  type CropRect,
} from "@/lib/compress-image";
import { canvasToJpegBlob, enhance, type EnhanceMode } from "@/lib/image-enhance";
import { CropPreview } from "@/components/CropPreview";
import { downloadBytes } from "@/lib/pdf-utils";

export const Route = createFileRoute("/tools/pdf-maker")({
  head: () => ({
    meta: [
      { title: "PDF Maker — Scan & Build PDFs from Your Camera" },
      {
        name: "description",
        content:
          "Capture pages with your camera, auto-enhance like a doc scanner, reorder and export as a PDF. Runs 100% on your device.",
      },
      { property: "og:title", content: "PDF Maker — Doc Scanner in Your Browser" },
      {
        property: "og:description",
        content: "Scan pages with your camera and build a PDF, no upload required.",
      },
    ],
  }),
  component: Page,
});

interface Shot {
  id: string;
  bitmap: ImageBitmap;
  previewUrl: string;
  mode: EnhanceMode;
}

const MODE_LABELS: Record<EnhanceMode, string> = {
  auto: "Auto",
  magic: "Magic Color",
  bw: "Black & White",
  gray: "Grayscale",
  original: "Original",
};

function Page() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageSize, setPageSize] = useState<"a4" | "letter" | "fit">("a4");
  const [filename, setFilename] = useState("scan.pdf");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      shots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFromFile = async (files: FileList | null) => {
    if (!files) return;
    const next: Shot[] = [];
    for (const f of Array.from(files)) {
      try {
        const bmp = await loadBitmap(f);
        const url = URL.createObjectURL(f);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          bitmap: bmp,
          previewUrl: url,
          mode: "auto",
        });
      } catch {
        /* skip */
      }
    }
    setShots((prev) => [...prev, ...next]);
  };

  const onCaptured = async (file: File) => {
    setCameraOpen(false);
    const bmp = await loadBitmap(file);
    const url = URL.createObjectURL(file);
    setShots((p) => [
      ...p,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        bitmap: bmp,
        previewUrl: url,
        mode: "auto",
      },
    ]);
  };

  const remove = (id: string) => {
    setShots((prev) => {
      const s = prev.find((x) => x.id === id);
      if (s) URL.revokeObjectURL(s.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    setShots((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const updateShot = (id: string, patch: Partial<Shot>) => {
    setShots((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (patch.previewUrl && s.previewUrl !== patch.previewUrl) {
          URL.revokeObjectURL(s.previewUrl);
        }
        return { ...s, ...patch };
      }),
    );
  };

  const generate = async () => {
    if (!shots.length) return;
    setBusy(true);
    try {
      const pdf = await PDFDocument.create();
      for (const s of shots) {
        const canvas = await enhance(s.bitmap, s.mode);
        const jpg = await canvasToJpegBlob(canvas, 0.9);
        const bytes = new Uint8Array(await jpg.arrayBuffer());
        const img = await pdf.embedJpg(bytes);
        let pw: number, ph: number;
        if (pageSize === "fit") {
          pw = img.width;
          ph = img.height;
        } else {
          // A4 (595x842) or Letter (612x792), fit image inside with margins.
          const [PW, PH] = pageSize === "a4" ? [595, 842] : [612, 792];
          pw = PW;
          ph = PH;
        }
        const page = pdf.addPage([pw, ph]);
        if (pageSize === "fit") {
          page.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
        } else {
          const margin = 24;
          const maxW = pw - margin * 2;
          const maxH = ph - margin * 2;
          const scale = Math.min(maxW / img.width, maxH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, {
            x: (pw - w) / 2,
            y: (ph - h) / 2,
            width: w,
            height: h,
          });
        }
      }
      const bytes = await pdf.save();
      downloadBytes(
        bytes,
        filename.endsWith(".pdf") ? filename : `${filename || "scan"}.pdf`,
      );
    } finally {
      setBusy(false);
    }
  };

  const editingShot = useMemo(
    () => shots.find((s) => s.id === editing) ?? null,
    [editing, shots],
  );

  return (
    <ToolShell
      title="PDF Maker"
      description="Capture pages with your camera, auto-enhance and export as a PDF."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-6 text-primary hover:bg-primary/10"
        >
          <Camera className="h-6 w-6" />
          <span className="text-sm font-semibold">Capture with camera</span>
          <span className="text-[11px] text-muted-foreground">Rear camera preferred</span>
        </button>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 hover:bg-muted">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-semibold">Add from files</span>
          <span className="text-[11px] text-muted-foreground">JPG / PNG / WEBP</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFromFile(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {shots.length > 0 && (
        <>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Pages ({shots.length}) — order = PDF order
              </h3>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" /> Add more
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {shots.map((s, i) => (
                <div
                  key={s.id}
                  className="group relative overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <button
                    type="button"
                    onClick={() => setEditing(s.id)}
                    className="block w-full"
                  >
                    <img
                      src={s.previewUrl}
                      alt={`page ${i + 1}`}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </button>
                  <div className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {i + 1}
                  </div>
                  <div className="absolute right-1 top-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      className="rounded bg-black/60 p-1 text-white hover:bg-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-1.5 py-1 text-[10px] text-white">
                    <button
                      type="button"
                      onClick={() => move(s.id, -1)}
                      disabled={i === 0}
                      className="rounded px-1 hover:bg-white/20 disabled:opacity-30"
                    >
                      ←
                    </button>
                    <span className="truncate">{MODE_LABELS[s.mode]}</span>
                    <button
                      type="button"
                      onClick={() => move(s.id, 1)}
                      disabled={i === shots.length - 1}
                      className="rounded px-1 hover:bg-white/20 disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Page size:</span>
              {(["a4", "letter", "fit"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPageSize(k)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    pageSize === k
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  {k === "a4" ? "A4" : k === "letter" ? "Letter" : "Fit image"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">Filename:</label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={busy || !shots.length}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Generate & download PDF
            </button>
          </div>
        </>
      )}

      {shots.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <ScanLine className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No pages yet</p>
          <p className="text-xs text-muted-foreground">
            Capture with your camera or pick images to start scanning.
          </p>
        </div>
      )}

      {cameraOpen && (
        <CameraCapture onCapture={onCaptured} onClose={() => setCameraOpen(false)} />
      )}

      {editingShot && (
        <PageEditor
          shot={editingShot}
          onClose={() => setEditing(null)}
          onUpdate={(patch) => updateShot(editingShot.id, patch)}
        />
      )}
    </ToolShell>
  );
}

function PageEditor({
  shot,
  onClose,
  onUpdate,
}: {
  shot: Shot;
  onClose: () => void;
  onUpdate: (patch: Partial<Shot>) => void;
}) {
  const [mode, setMode] = useState<EnhanceMode>(shot.mode);
  const [preview, setPreview] = useState<string>(shot.previewUrl);
  const [busy, setBusy] = useState(false);
  const previewOwnRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await enhance(shot.bitmap, mode);
      const blob = await canvasToJpegBlob(c, 0.9);
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      if (previewOwnRef.current) URL.revokeObjectURL(previewOwnRef.current);
      previewOwnRef.current = url;
      setPreview(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, shot.bitmap]);

  useEffect(() => {
    return () => {
      if (previewOwnRef.current) URL.revokeObjectURL(previewOwnRef.current);
    };
  }, []);

  const commitBitmap = async (bmp: ImageBitmap) => {
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(
        (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
        "image/jpeg",
        0.95,
      ),
    );
    const url = URL.createObjectURL(blob);
    onUpdate({ bitmap: bmp, previewUrl: url, mode });
  };

  const applyCrop = async (rect: CropRect) => {
    setBusy(true);
    try {
      const bmp = await cropBitmap(shot.bitmap, rect);
      await commitBitmap(bmp);
    } finally {
      setBusy(false);
    }
  };
  const applyRotate = async (deg: number) => {
    setBusy(true);
    try {
      const bmp = await rotateBitmap(shot.bitmap, deg);
      await commitBitmap(bmp);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="text-sm font-semibold">Edit page</div>
          <button
            type="button"
            onClick={() => {
              onUpdate({ mode });
              onClose();
            }}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-auto p-4">
          <div className="rounded-md bg-muted p-2 text-center">
            <img
              src={preview}
              alt="preview"
              className="mx-auto max-h-[45vh] w-auto object-contain"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">Enhance</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(MODE_LABELS) as EnhanceMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    mode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <CropPreview
            url={shot.previewUrl}
            naturalWidth={shot.bitmap.width}
            naturalHeight={shot.bitmap.height}
            onApplyCrop={applyCrop}
            onReset={() => undefined}
            onRotateLeft={() => applyRotate(-90)}
            onRotateRight={() => applyRotate(90)}
            onRotateFine={(d) => applyRotateFine(d)}
            disabled={busy}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onUpdate({ mode });
              onClose();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
