import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileImage, FileText, Image as ImageIcon, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { ToolShell } from "@/components/ToolShell";
import { ServiceTile } from "@/components/ServiceTile";
import { downloadBlob, downloadBytes, pdfToImages } from "@/lib/pdf-utils";
import { canvasToBlob } from "@/lib/image-filters";
import { setJpegDpi } from "@/lib/compress-image";

export const Route = createFileRoute("/tools/convert")({
  head: () => ({
    meta: [
      { title: "File Converter — Images and PDFs" },
      { name: "description", content: "Convert images and PDFs locally with previews, DPI, and page sizing." },
      { property: "og:title", content: "File Converter" },
      { property: "og:description", content: "Convert images and PDFs locally with previews, DPI, and page sizing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Tool = "img" | "pdf2img" | "img2pdf";
type ImageItem = { id: string; file: File; bitmap: ImageBitmap; url: string; rotation: number };

function Page() {
  const [tool, setTool] = useState<Tool>("img");
  return (
    <ToolShell title="File Converter" description="Convert between common image formats and PDF. Everything happens locally.">
      <div className="grid grid-cols-3 gap-2">
        <ServiceTile active={tool === "img"} onClick={() => setTool("img")} title="Image ↔ Image" icon={ImageIcon} />
        <ServiceTile active={tool === "pdf2img"} onClick={() => setTool("pdf2img")} title="PDF → Image" icon={FileImage} />
        <ServiceTile active={tool === "img2pdf"} onClick={() => setTool("img2pdf")} title="Image → PDF" icon={FileText} />
      </div>
      <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Conversions run locally in your browser.
      </div>
      {tool === "img" && <ImageConvertPanel />}
      {tool === "pdf2img" && <PdfToImagesPanel />}
      {tool === "img2pdf" && <ImagesToPdfPanel />}
    </ToolShell>
  );
}

function Picker({ accept, multiple, label, onFiles }: { accept: string; multiple?: boolean; label: string; onFiles: (files: File[]) => void }) {
  const id = useMemo(() => `picker-${Math.random().toString(36).slice(2)}`, []);
  return (
    <label htmlFor={id} className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center hover:bg-muted">
      <Upload className="h-5 w-5 text-muted-foreground" />
      <div className="mt-1 text-sm font-medium">{label}</div>
      <input id={id} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
    </label>
  );
}

function ImageConvertPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<"jpeg" | "png" | "webp">("jpeg");
  const [dpi, setDpi] = useState(300);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const bmp = await createImageBitmap(file);
      const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext("2d"); if (!ctx) throw new Error("Canvas is unavailable");
      if (target === "jpeg") { ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(bmp, 0, 0);
      let blob = await canvasToBlob(c, `image/${target}`, 0.95);
      if (target === "jpeg") blob = await setJpegDpi(blob, dpi);
      downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, "")}.${target === "jpeg" ? "jpg" : target}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <Panel title="Image → Image">
    <Picker accept="image/*,.heic,.heif,.avif,.bmp,.tiff,.tif,.gif" label={file?.name ?? "Pick an image"} onFiles={(fs) => setFile(fs[0] ?? null)} />
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-medium text-muted-foreground">Format:</span>{(["jpeg", "png", "webp"] as const).map((x) => <Choice key={x} active={target === x} onClick={() => setTarget(x)}>{x.toUpperCase()}</Choice>)}</div>
    <label className="flex items-center gap-2 text-xs">DPI <input type="number" min="1" value={dpi} onChange={(e) => setDpi(Math.max(1, +e.target.value || 300))} className="w-20 rounded border border-input bg-background px-2 py-1" /></label>
    <Action busy={busy} disabled={!file} onClick={run}>Convert &amp; download</Action>
    {error && <p className="text-xs text-destructive">{error}</p>}
  </Panel>;
}

function PdfToImagesPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [previews, setPreviews] = useState<{ blob: Blob; name: string }[]>([]);
  const [format, setFormat] = useState<"jpeg" | "png">("jpeg");
  const [dpi, setDpi] = useState(150); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = async (f: File) => { setFile(f); setBusy(true); setError(null); try { setPreviews(await pdfToImages(f, dpi / 72, format)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const run = async () => { if (!file) return; setBusy(true); try { const pages = await pdfToImages(file, dpi / 72, format); pages.forEach((p, i) => setTimeout(() => downloadBlob(p.blob, p.name), i * 150)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <Panel title="PDF → Image"><Picker accept="application/pdf" label={file?.name ?? "Pick a PDF"} onFiles={(fs) => { if (fs[0]) void load(fs[0]); }} />
    {busy && <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Loading PDF previews…</p>}
    {previews.length > 0 && <div className="grid grid-cols-3 gap-2">{previews.map((p) => <PreviewBlob key={p.name} blob={p.blob} label={p.name} />)}</div>}
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-medium text-muted-foreground">Output:</span>{(["jpeg", "png"] as const).map((x) => <Choice key={x} active={format === x} onClick={() => { setFormat(x); if (file) void load(file); }}>{x.toUpperCase()}</Choice>)}<label>DPI <input type="number" min="36" value={dpi} onChange={(e) => setDpi(Math.max(36, +e.target.value || 150))} className="w-16 rounded border border-input bg-background px-1 py-1" /></label></div>
    <Action busy={busy} disabled={!file} onClick={run}>Render &amp; download pages</Action>{error && <p className="text-xs text-destructive">{error}</p>}</Panel>;
}

function ImagesToPdfPanel() {
  const [items, setItems] = useState<ImageItem[]>([]); const [pageSize, setPageSize] = useState<"image" | "a4" | "letter">("image"); const [dpi, setDpi] = useState(300); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => () => items.forEach((x) => { URL.revokeObjectURL(x.url); x.bitmap.close(); }), []);
  const add = async (files: File[]) => { const next: ImageItem[] = []; for (const file of files) { try { const bitmap = await createImageBitmap(file); next.push({ id: `${Date.now()}-${Math.random()}`, file, bitmap, url: URL.createObjectURL(file), rotation: 0 }); } catch { /* unsupported image */ } } setItems((x) => [...x, ...next]); };
  const rotate = (id: string) => setItems((xs) => xs.map((x) => x.id === id ? { ...x, rotation: (x.rotation + 90) % 360 } : x));
  const remove = (id: string) => setItems((xs) => { const x = xs.find((i) => i.id === id); if (x) { URL.revokeObjectURL(x.url); x.bitmap.close(); } return xs.filter((i) => i.id !== id); });
  const run = async () => { setBusy(true); setError(null); try { const doc = await PDFDocument.create(); for (const item of items) { const c = document.createElement("canvas"); const rotated = item.rotation % 180 !== 0; c.width = rotated ? item.bitmap.height : item.bitmap.width; c.height = rotated ? item.bitmap.width : item.bitmap.height; const ctx = c.getContext("2d"); if (!ctx) throw new Error("Canvas is unavailable"); ctx.translate(c.width / 2, c.height / 2); ctx.rotate(item.rotation * Math.PI / 180); ctx.drawImage(item.bitmap, -item.bitmap.width / 2, -item.bitmap.height / 2); const blob = await canvasToBlob(c, "image/jpeg", 0.94); const img = await doc.embedJpg(await blob.arrayBuffer()); const [pw, ph] = pageSize === "a4" ? [595, 842] : pageSize === "letter" ? [612, 792] : [img.width / dpi * 72, img.height / dpi * 72]; const page = doc.addPage([pw, ph]); const scale = pageSize === "image" ? 1 : Math.min((pw - 48) / img.width, (ph - 48) / img.height); page.drawImage(img, { x: (pw - img.width * scale) / 2, y: (ph - img.height * scale) / 2, width: img.width * scale, height: img.height * scale }); } downloadBytes(await doc.save(), "images.pdf"); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <Panel title="Image(s) → PDF"><Picker accept="image/*,.heic,.heif,.avif,.bmp,.tiff,.tif,.gif" multiple label={items.length ? `${items.length} image(s) selected` : "Pick images"} onFiles={(fs) => void add(fs)} />
    {items.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{items.map((x, i) => <div key={x.id} className="relative overflow-hidden rounded border border-border bg-muted"><img src={x.url} alt={`selected image ${i + 1}`} className="aspect-square w-full object-cover" /><span className="absolute left-1 top-1 rounded bg-background/90 px-1 text-[10px]">{i + 1}</span><div className="absolute right-1 top-1 flex gap-1"><button type="button" aria-label={`Rotate image ${i + 1}`} onClick={() => rotate(x.id)} className="rounded bg-background/90 p-1"><RotateCcw className="h-3 w-3" /></button><button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => remove(x.id)} className="rounded bg-background/90 p-1 text-destructive"><Trash2 className="h-3 w-3" /></button></div></div>)}</div>}
    <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-medium text-muted-foreground">Page size:</span>{(["image", "a4", "letter"] as const).map((x) => <Choice key={x} active={pageSize === x} onClick={() => setPageSize(x)}>{x === "image" ? "Image size" : x.toUpperCase()}</Choice>)}<label>DPI <input type="number" min="1" value={dpi} onChange={(e) => setDpi(Math.max(1, +e.target.value || 300))} className="w-16 rounded border border-input bg-background px-1 py-1" /></label></div>
    <Action busy={busy} disabled={!items.length} onClick={run}>Build &amp; download PDF</Action>{error && <p className="text-xs text-destructive">{error}</p>}</Panel>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm"><h3 className="text-sm font-semibold">{title}</h3>{children}</div>; }
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}>{children}</button>; }
function Action({ busy, disabled, onClick, children }: { busy?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" disabled={busy || disabled} onClick={onClick} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>; }
function PreviewBlob({ blob, label }: { blob: Blob; label: string }) { const [url, setUrl] = useState(""); useEffect(() => { const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]); return url ? <img src={url} alt={label} className="aspect-[3/4] w-full rounded border border-border object-contain" /> : null; }