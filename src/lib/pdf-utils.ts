import { PDFDocument, degrees } from "pdf-lib";

export async function readPdf(file: File | Blob): Promise<PDFDocument> {
  const bytes = await file.arrayBuffer();
  return await PDFDocument.load(bytes);
}

export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await readPdf(f);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return await out.save();
}

// Parse "1-3,5,8-10" against pageCount → 0-based indices (deduped, ordered).
export function parseRanges(input: string, pageCount: number): number[] {
  const out = new Set<number>();
  for (const raw of input.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    const lo = Math.max(1, Math.min(pageCount, Math.min(a, b)));
    const hi = Math.max(1, Math.min(pageCount, Math.max(a, b)));
    for (let i = lo; i <= hi; i++) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}

export async function extractPages(file: File, indices: number[]): Promise<Uint8Array> {
  const src = await readPdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return await out.save();
}

export async function deletePages(file: File, indices: number[]): Promise<Uint8Array> {
  const src = await readPdf(file);
  const keep = src.getPageIndices().filter((i) => !indices.includes(i));
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keep);
  pages.forEach((p) => out.addPage(p));
  return await out.save();
}

export async function reorderPages(file: File, order: number[]): Promise<Uint8Array> {
  const src = await readPdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, order);
  pages.forEach((p) => out.addPage(p));
  return await out.save();
}

export async function rotatePdf(
  file: File,
  deg: 90 | 180 | 270,
  indices?: number[],
): Promise<Uint8Array> {
  const src = await readPdf(file);
  const targets = indices ?? src.getPageIndices();
  for (const i of targets) {
    const p = src.getPage(i);
    const cur = p.getRotation().angle;
    p.setRotation(degrees((cur + deg) % 360));
  }
  return await src.save();
}

export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const isPng = f.type === "image/png" || /\.png$/i.test(f.name);
    const img = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    const page = out.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return await out.save();
}

export function downloadBytes(bytes: Uint8Array, filename: string, mime = "application/pdf") {
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Render every page of a PDF to a PNG blob using pdfjs-dist.
export async function pdfToImages(
  file: File,
  scale = 2,
  format: "png" | "jpeg" = "png",
  quality = 0.92,
): Promise<{ blob: Blob; name: string }[]> {
  return renderPdfPages(file, undefined, scale, format, quality);
}

export async function renderPdfPages(
  file: File,
  indices?: number[],
  scale = 2,
  format: "png" | "jpeg" = "png",
  quality = 0.92,
): Promise<{ blob: Blob; name: string }[]> {
  const pdfjs = await import("pdfjs-dist");
  // Vite-friendly worker resolution
  const workerUrl = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  // @ts-ignore
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const out: { blob: Blob; name: string }[] = [];
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const ext = format === "png" ? "png" : "jpg";
  const base = file.name.replace(/\.pdf$/i, "");
  const pageNumbers = indices?.map((index) => index + 1) ?? Array.from({ length: doc.numPages }, (_, i) => i + 1);
  for (const i of pageNumbers) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = viewport.width;
    c.height = viewport.height;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Could not create a canvas for PDF rendering.");
    // @ts-ignore
    await page.render({ canvasContext: ctx, viewport, canvas: c }).promise;
    const blob = await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), mime, quality),
    );
    out.push({ blob, name: `${base}-p${i}.${ext}` });
  }
  return out;
}

export async function compressPdfToTarget(
  input: File | Uint8Array,
  targetBytes: number,
  onProgress?: (progress: number) => void,
): Promise<{ bytes: Uint8Array; reachedTarget: boolean; originalBytes: number }> {
  const source = input instanceof File ? input : new File([new Uint8Array(input)], "document.pdf", { type: "application/pdf" });
  const originalBytes = source.size;
  const candidates = [
    { scale: 1.5, quality: 0.9 },
    { scale: 1.25, quality: 0.86 },
    { scale: 1, quality: 0.82 },
    { scale: 0.85, quality: 0.78 },
    { scale: 0.7, quality: 0.72 },
    { scale: 0.55, quality: 0.65 },
  ];
  let best: Uint8Array | null = null;
  let bestSize = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < candidates.length; attempt++) {
    const candidate = candidates[attempt];
    const images = await pdfToImages(source, candidate.scale, "jpeg", candidate.quality);
    const out = await PDFDocument.create();
    for (const image of images) {
      const embedded = await out.embedJpg(new Uint8Array(await image.blob.arrayBuffer()));
      const page = out.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    }
    const bytes = await out.save();
    if (bytes.length < bestSize) {
      best = bytes;
      bestSize = bytes.length;
    }
    onProgress?.(Math.round(((attempt + 1) / candidates.length) * 100));
    if (bytes.length <= targetBytes) {
      return { bytes, reachedTarget: true, originalBytes };
    }
  }

  if (!best) throw new Error("Could not compress this PDF.");
  return { bytes: best, reachedTarget: best.length <= targetBytes, originalBytes };
}
