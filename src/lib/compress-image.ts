// Browser image utilities: EXIF-aware decoding, rotation, vertical merge,
// clarity-first JPEG compression, DPI tagging, and PNG encoding.

/**
 * Rewrite the JFIF APP0 marker of a JPEG so print software reports the
 * given DPI (Xdensity / Ydensity). Metadata-only edit — pixels and file
 * size are unchanged.
 */
export async function setJpegDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // SOI must be FFD8; next marker FFE0 (APP0) with "JFIF\0" identifier.
  if (buf.length < 20 || buf[0] !== 0xff || buf[1] !== 0xd8) return blob;
  if (buf[2] !== 0xff || buf[3] !== 0xe0) return blob;
  // Identifier at offset 6..10 = "JFIF\0"
  if (
    buf[6] !== 0x4a ||
    buf[7] !== 0x46 ||
    buf[8] !== 0x49 ||
    buf[9] !== 0x46 ||
    buf[10] !== 0x00
  ) {
    return blob;
  }
  const out = buf.slice();
  const d = Math.max(1, Math.min(65535, Math.round(dpi)));
  out[13] = 0x01; // units = inches
  out[14] = (d >> 8) & 0xff; // Xdensity high
  out[15] = d & 0xff; // Xdensity low
  out[16] = (d >> 8) & 0xff; // Ydensity high
  out[17] = d & 0xff; // Ydensity low
  return new Blob([out], { type: "image/jpeg" });
}

/** Encode a bitmap losslessly to PNG. */
export async function encodePng(bitmap: ImageBitmap): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))),
      "image/png",
    );
  });
}


export async function loadBitmap(file: File): Promise<ImageBitmap> {
  return await createImageBitmap(file, { imageOrientation: "from-image" });
}

function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.canvas;
}

export async function rotateBitmap(
  bitmap: ImageBitmap,
  degrees: number,
): Promise<ImageBitmap> {
  const rad = ((degrees % 360) * Math.PI) / 180;
  if (rad === 0) return bitmap;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w = bitmap.width;
  const h = bitmap.height;
  const newW = Math.round(w * cos + h * sin);
  const newH = Math.round(w * sin + h * cos);
  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.drawImage(bitmap, -w / 2, -h / 2);
  return await createImageBitmap(canvas);
}

export async function mergeVertical(
  top: ImageBitmap,
  bottom: ImageBitmap,
): Promise<ImageBitmap> {
  const width = top.width;
  const scale = width / bottom.width;
  const bottomHeight = Math.round(bottom.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = top.height + bottomHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(top, 0, 0, width, top.height);
  ctx.drawImage(bottom, 0, top.height, width, bottomHeight);
  return await createImageBitmap(canvas);
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function cropBitmap(
  bitmap: ImageBitmap,
  rect: CropRect,
): Promise<ImageBitmap> {
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const w = Math.max(1, Math.min(bitmap.width - x, Math.round(rect.w)));
  const h = Math.max(1, Math.min(bitmap.height - y, Math.round(rect.h)));
  if (x === 0 && y === 0 && w === bitmap.width && h === bitmap.height) return bitmap;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas 2D context unavailable");
  octx.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
  return await createImageBitmap(out);
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}

export interface CompressResult {
  blob: Blob;
  sizeKB: number;
  width: number;
  height: number;
  quality: number;
}

/**
 * Compress bitmap to a JPEG whose size in bytes satisfies minBytes < size < maxBytes.
 * Clarity-first: keep resolution as high as possible; only downscale if we cannot
 * fit under maxBytes. Upscale slightly if we cannot exceed minBytes.
 *
 * Robustness: always returns the best encode attempted (closest to the target
 * midpoint) even if no encode strictly landed in range. Handles multi-MB inputs
 * by starting from a resolution proportional to the target size.
 */
export async function compressToRange(
  bitmap: ImageBitmap,
  minBytes: number,
  maxBytes: number,
): Promise<CompressResult> {
  const maxAttempts = 80;
  let attempts = 0;
  const midBytes = (minBytes + maxBytes) / 2;
  let bestOverall: CompressResult | null = null;
  let bestUnder: CompressResult | null = null;
  let bestOverallDist = Infinity;

  const consider = (r: CompressResult) => {
    const d = Math.abs(r.blob.size - midBytes);
    if (d < bestOverallDist) {
      bestOverallDist = d;
      bestOverall = r;
    }
    if (r.blob.size < maxBytes) {
      if (!bestUnder || r.blob.size > bestUnder.blob.size) bestUnder = r;
    }
  };

  const encode = async (s: number, q: number): Promise<CompressResult> => {
    attempts++;
    const canvas = drawToCanvas(bitmap, bitmap.width * s, bitmap.height * s);
    const blob = await canvasToBlob(canvas, q);
    const r: CompressResult = {
      blob,
      sizeKB: blob.size / 1024,
      width: canvas.width,
      height: canvas.height,
      quality: q,
    };
    consider(r);
    return r;
  };

  // Heuristic starting scale: aim for pixel count ~ maxBytes * 8 (roughly
  // matches JPEG at q≈0.8 for photos). Cap at 1 so we never upscale first.
  const pixels = bitmap.width * bitmap.height;
  const targetPixels = Math.max(maxBytes * 8, 40_000);
  let scale = Math.min(1, Math.sqrt(targetPixels / pixels));
  if (!isFinite(scale) || scale <= 0) scale = 1;

  // Iterate: binary-search quality at each scale; if largest-under is in
  // range, done. Otherwise adjust scale.
  while (attempts < maxAttempts) {
    let lo = 0.35;
    let hi = 0.98;
    let localBestUnder: CompressResult | null = null;
    for (let i = 0; i < 7 && attempts < maxAttempts; i++) {
      const q = (lo + hi) / 2;
      const r = await encode(scale, q);
      if (r.blob.size < maxBytes) {
        if (!localBestUnder || r.blob.size > localBestUnder.blob.size) {
          localBestUnder = r;
        }
        lo = q;
      } else {
        hi = q;
      }
    }

    if (localBestUnder) {
      if (localBestUnder.blob.size > minBytes) {
        return localBestUnder; // in range
      }
      // Under min: try to push size up by upscaling.
      if (scale >= 4) break;
      scale *= 1.15;
      continue;
    }

    // Even lowest tested quality exceeds maxBytes → downscale aggressively.
    if (scale <= 0.03) break;
    scale *= 0.7;
  }

  const result = bestUnder ?? bestOverall;
  if (!result) {
    // Last-ditch effort so we never throw.
    const canvas = drawToCanvas(bitmap, bitmap.width * 0.25, bitmap.height * 0.25);
    const blob = await canvasToBlob(canvas, 0.4);
    return {
      blob,
      sizeKB: blob.size / 1024,
      width: canvas.width,
      height: canvas.height,
      quality: 0.4,
    };
  }
  return result;
}
