// Browser image utilities: EXIF-aware decoding, rotation, vertical merge,
// and clarity-first JPEG compression into a strict KB range.

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
 */
export async function compressToRange(
  bitmap: ImageBitmap,
  minBytes: number,
  maxBytes: number,
): Promise<CompressResult> {
  let attempts = 0;
  const maxAttempts = 40;
  let scale = 1;
  let best: CompressResult | null = null;
  let bestUnder: CompressResult | null = null; // largest size still < maxBytes

  const encode = async (s: number, q: number): Promise<CompressResult> => {
    attempts++;
    const canvas = drawToCanvas(bitmap, bitmap.width * s, bitmap.height * s);
    const blob = await canvasToBlob(canvas, q);
    return {
      blob,
      sizeKB: blob.size / 1024,
      width: canvas.width,
      height: canvas.height,
      quality: q,
    };
  };

  // Phase 1: at current scale binary-search quality for largest size < maxBytes.
  // If bestUnder is in range, done. If bestUnder <= minBytes, try upscaling.
  // If even q=0.5 at this scale >= maxBytes, downscale.
  while (attempts < maxAttempts) {
    let lo = 0.4;
    let hi = 0.98;
    let localBest: CompressResult | null = null;
    for (let i = 0; i < 8 && attempts < maxAttempts; i++) {
      const q = (lo + hi) / 2;
      const r = await encode(scale, q);
      if (r.blob.size < maxBytes) {
        localBest = r;
        lo = q;
      } else {
        hi = q;
      }
    }

    if (localBest) {
      bestUnder = localBest;
      if (localBest.blob.size > minBytes) {
        return localBest; // in range
      }
      // Under min: try to push up by upscaling
      if (scale >= 4) {
        best = localBest;
        break;
      }
      scale *= 1.15;
      continue;
    } else {
      // Even lowest tried quality is too big; downscale
      if (scale <= 0.05) {
        // give up; return smallest we can
        const r = await encode(scale, 0.4);
        best = r;
        break;
      }
      scale *= 0.85;
      continue;
    }
  }

  const result = bestUnder ?? best;
  if (!result) throw new Error("Compression failed");
  return result;
}
