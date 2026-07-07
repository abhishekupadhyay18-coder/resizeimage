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

/**
 * Auto-crop uniform borders. `sensitivity` is 0–100:
 *  - 0   → disabled (returns the bitmap unchanged)
 *  - 50  → balanced (default)
 *  - 100 → very aggressive: high color tolerance, low match ratio, no min-area guard
 */
export async function autoCropBitmap(
  bitmap: ImageBitmap,
  sensitivity = 50,
): Promise<ImageBitmap> {
  if (sensitivity <= 0) return bitmap;
  const s = Math.min(100, Math.max(1, sensitivity)) / 100;
  // Map sensitivity → thresholds.
  const tol = Math.round(8 + s * 62); // 8..70 per-channel tolerance
  const rowMatchRatio = 0.999 - s * 0.099; // 0.999..0.90
  const minAreaFrac = 0.6 - s * 0.55; // 0.60..0.05 (higher sensitivity = allow tighter crops)

  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]] as const;
  };
  const corners = [sample(0, 0), sample(w - 1, 0), sample(0, h - 1), sample(w - 1, h - 1)];
  const bg = [0, 1, 2].map(
    (k) => corners.reduce((sum, c) => sum + c[k], 0) / corners.length,
  );

  const isBg = (i: number) =>
    Math.abs(data[i] - bg[0]) <= tol &&
    Math.abs(data[i + 1] - bg[1]) <= tol &&
    Math.abs(data[i + 2] - bg[2]) <= tol;

  const rowIsBg = (y: number) => {
    let hit = 0;
    const base = y * w * 4;
    for (let x = 0; x < w; x++) if (isBg(base + x * 4)) hit++;
    return hit / w >= rowMatchRatio;
  };
  const colIsBg = (x: number) => {
    let hit = 0;
    for (let y = 0; y < h; y++) if (isBg((y * w + x) * 4)) hit++;
    return hit / h >= rowMatchRatio;
  };

  let top = 0;
  while (top < h - 1 && rowIsBg(top)) top++;
  let bottom = h - 1;
  while (bottom > top && rowIsBg(bottom)) bottom--;
  let left = 0;
  while (left < w - 1 && colIsBg(left)) left++;
  let right = w - 1;
  while (right > left && colIsBg(right)) right--;

  // Safety pad shrinks as sensitivity grows.
  const padFrac = 0.01 * (1 - s);
  const pad = Math.round(Math.min(w, h) * padFrac);
  top = Math.max(0, top - pad);
  left = Math.max(0, left - pad);
  bottom = Math.min(h - 1, bottom + pad);
  right = Math.min(w - 1, right + pad);

  const cw = right - left + 1;
  const ch = bottom - top + 1;
  if (cw >= w * 0.995 && ch >= h * 0.995) return bitmap;
  if (cw * ch < w * h * minAreaFrac) return bitmap;

  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas 2D context unavailable");
  octx.drawImage(bitmap, left, top, cw, ch, 0, 0, cw, ch);
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
