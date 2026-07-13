import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { FileImage, FileText, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { ToolShell } from "@/components/ToolShell";
import { ServiceTile } from "@/components/ServiceTile";
import { downloadBlob, downloadBytes, imagesToPdf, pdfToImages } from "@/lib/pdf-utils";

export const Route = createFileRoute("/tools/convert")({
  head: () => ({
    meta: [
      { title: "File Converter — Tools Hub" },
      {
        name: "description",
        content:
          "Convert JPG, PNG, WEBP, HEIC, BMP, GIF, PDF ↔ image — all in your browser.",
      },
      { property: "og:title", content: "File Converter" },
      {
        property: "og:description",
        content: "Convert between all common image formats and PDF ↔ image formats.",
      },
    ],
  }),
  component: Page,
});

type Tool = "img" | "pdf2img" | "img2pdf";

function Page() {
  const [tool, setTool] = useState<Tool>("img");
  return (
    <ToolShell
      title="File Converter"
      description="Convert between common image formats and PDF. Everything happens locally."
    >
      <div className="grid grid-cols-3 gap-2">
        <ServiceTile active={tool === "img"} onClick={() => setTool("img")} title="Image ↔ Image" icon={ImageIcon} />
        <ServiceTile active={tool === "pdf2img"} onClick={() => setTool("pdf2img")} title="PDF → Image" icon={FileImage} />
        <ServiceTile active={tool === "img2pdf"} onClick={() => setTool("img2pdf")} title="Image → PDF" icon={FileText} />
      </div>

      <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Server-only conversions (Word/Excel/PPT ↔ PDF) are not included — this app runs entirely in your browser.
      </div>

      {tool === "img" && <ImageConvertPanel />}
      {tool === "pdf2img" && <PdfToImagesPanel />}
      {tool === "img2pdf" && <ImagesToPdfPanel />}
    </ToolShell>
  );
}

function ImageConvertPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<"jpeg" | "png" | "webp">("jpeg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const targetLabel = target === "jpeg" ? "JPEG" : target.toUpperCase();
  const ext = target === "jpeg" ? "jpg" : target;

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bmp = await createImageBitmap(file);
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d")!;
      if (target === "jpeg") {
        // JPEG has no alpha — flatten onto white to avoid black backgrounds.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.drawImage(bmp, 0, 0);
      const mime = `image/${target}`;
      const blob = await new Promise<Blob>((res, rej) =>
        c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), mime, 0.95),
      );
      const base = file.name.replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}.${ext}`);
    } catch (e) {
      setError(
        `Could not decode this image (${(e as Error).message}). Some formats like HEIC/TIFF may not be supported by your browser.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold">Image → Image (JPEG / PNG / WEBP)</h3>
      <FileDropzone
        accept="image/*,.heic,.heif,.avif,.bmp,.tiff,.tif,.gif"
        onFile={setFile}
        inputRef={inputRef}
        label={file ? file.name : "Drop or click to pick any image"}
      />
      <p className="text-[11px] text-muted-foreground">
        Accepts JPG, PNG, WEBP, GIF, BMP, AVIF and any format your browser can decode
        (HEIC/TIFF depend on browser support).
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Convert to:</span>
        {(["jpeg", "png", "webp"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTarget(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              target === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent"
            }`}
          >
            {t === "jpeg" ? "JPEG" : t.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={convert}
        disabled={!file || busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Convert & download {targetLabel}
      </button>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

function PdfToImagesPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<"jpeg" | "png">("jpeg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const pages = await pdfToImages(file, 2, format);
      pages.forEach((p, i) => setTimeout(() => downloadBlob(p.blob, p.name), i * 200));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold">PDF → Image (per page)</h3>
      <FileDropzone
        accept="application/pdf"
        onFile={setFile}
        inputRef={inputRef}
        label={file ? file.name : "Drop or click to pick a PDF"}
      />
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Output:</span>
        {(["jpeg", "png"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFormat(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              format === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent"
            }`}
          >
            {t === "jpeg" ? "JPEG" : "PNG"}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={run}
        disabled={!file || busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Render & download pages
      </button>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

function ImagesToPdfPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      // Normalize every image to JPEG first so any browser-decodable format works.
      const jpegs: File[] = [];
      for (const f of files) {
        if (f.type === "image/jpeg" || f.type === "image/png") {
          jpegs.push(f);
          continue;
        }
        const bmp = await createImageBitmap(f);
        const c = document.createElement("canvas");
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(bmp, 0, 0);
        const blob = await new Promise<Blob>((res, rej) =>
          c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.92),
        );
        jpegs.push(new File([blob], `${f.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" }));
      }
      const bytes = await imagesToPdf(jpegs);
      downloadBytes(bytes, "images.pdf");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold">Image(s) → PDF</h3>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center hover:bg-muted">
        <Upload className="h-5 w-5 text-muted-foreground" />
        <div className="mt-1 text-sm font-medium">
          {files.length ? `${files.length} image(s) selected` : "Drop or click to pick images"}
        </div>
        <div className="text-xs text-muted-foreground">Any image format · Order = selection order</div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif,.avif,.bmp,.tiff,.tif,.gif"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
      </label>
      <button
        type="button"
        onClick={run}
        disabled={!files.length || busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Build & download PDF
      </button>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

function FileDropzone({
  accept,
  onFile,
  inputRef,
  label,
}: {
  accept: string;
  onFile: (f: File) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
}) {
  const id = useMemo(() => `dz-${Math.random().toString(36).slice(2)}`, []);
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center hover:bg-muted"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <Upload className="h-5 w-5 text-muted-foreground" />
      <div className="mt-1 text-sm font-medium">{label}</div>
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}
