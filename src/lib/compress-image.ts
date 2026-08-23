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

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/**
 * High quality downscale: halve repeatedly (browser box-filters each step)
 * before the final draw, which keeps far more detail than one big jump.
 */
function steppedResize(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  width: number,
  height: number,
): HTMLCanvasElement {
  const targetW = Math.max(1, Math.round(width));
  const targetH = Math.max(1, Math.round(height));
  let cur: CanvasImageSource = source;
  let curW = srcW;
  let curH = srcH;
  while (curW / 2 > targetW && curH / 2 > targetH) {
    const c = newCanvas(curW / 2, curH / 2);
    const cx = c.getContext("2d")!;
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = "high";
    cx.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
    curW = c.width;
    curH = c.height;
  }
  const canvas = newCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur, 0, 0, targetW, targetH);
  return canvas;
}

/**
 * Unsharp-mask style sharpening applied in place. `amount` 0..1.
 * Keeps document text crisp after a downscale.
 */
function sharpenInPlace(canvas: HTMLCanvasElement, amount: number) {
  if (amount <= 0.01) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  if (w * h > 24_000_000) return;
  const src = ctx.getImageData(0, 0, w, h);
  const s = src.data;
  const out = ctx.createImageData(w, h);
  const d = out.data;
  const a = amount;
  const center = 1 + 4 * a;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const up = ((y > 0 ? y - 1 : 0) * w + x) * 4;
      const dn = ((y < h - 1 ? y + 1 : h - 1) * w + x) * 4;
      const lf = (y * w + (x > 0 ? x - 1 : 0)) * 4;
      const rt = (y * w + (x < w - 1 ? x + 1 : w - 1)) * 4;
      for (let c = 0; c < 3; c++) {
        const v =
          s[p + c] * center - a * (s[up + c] + s[dn + c] + s[lf + c] + s[rt + c]);
        d[p + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      d[p + 3] = s[p + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

/**
 * Render the bitmap at `scale` with high-quality stepped downscaling plus an
 * adaptive sharpening pass sized to how much detail the resize removed.
 */
function renderScaled(bitmap: ImageBitmap, scale: number): HTMLCanvasElement {
  const s = Math.max(0.01, Math.min(4, scale));
  const canvas = steppedResize(
    bitmap,
    bitmap.width,
    bitmap.height,
    bitmap.width * s,
    bitmap.height * s,
  );
  if (s < 0.995) {
    // More shrink → more sharpening, capped so it never looks crunchy.
    sharpenInPlace(canvas, Math.min(0.55, (1 - s) * 0.9 + 0.12));
  }
  return canvas;
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

/**
 * Largest axis-aligned rectangle with the source aspect ratio that fits
 * entirely inside a w×h rectangle rotated by `degrees`.
 */
export function inscribedRect(
  w: number,
  h: number,
  degrees: number,
): { w: number; h: number } {
  const rad = (Math.abs(degrees % 180) * Math.PI) / 180;
  if (rad === 0) return { w, h };
  const sinA = Math.abs(Math.sin(rad));
  const cosA = Math.abs(Math.cos(rad));
  const widthIsLonger = w >= h;
  const sideLong = widthIsLonger ? w : h;
  const sideShort = widthIsLonger ? h : w;
  let wr: number;
  let hr: number;
  if (sideShort <= 2 * sinA * cosA * sideLong || Math.abs(sinA - cosA) < 1e-10) {
    const x = 0.5 * sideShort;
    if (widthIsLonger) {
      wr = x / sinA;
      hr = x / cosA;
    } else {
      wr = x / cosA;
      hr = x / sinA;
    }
  } else {
    const cos2a = cosA * cosA - sinA * sinA;
    wr = (w * cosA - h * sinA) / cos2a;
    hr = (h * cosA - w * sinA) / cos2a;
  }
  return {
    w: Math.max(1, Math.min(w, Math.floor(wr))),
    h: Math.max(1, Math.min(h, Math.floor(hr))),
  };
}

/**
 * Rotate then auto-crop to the largest rectangle fully inside the rotated
 * frame, so no black/empty corners remain — like rotating in a phone gallery.
 */
export async function rotateBitmapCropped(
  bitmap: ImageBitmap,
  degrees: number,
): Promise<ImageBitmap> {
  const deg = degrees % 360;
  if (deg === 0) return bitmap;
  const rad = (deg * Math.PI) / 180;
  const w = bitmap.width;
  const h = bitmap.height;
  const target = inscribedRect(w, h, deg);
  const canvas = document.createElement("canvas");
  canvas.width = target.w;
  canvas.height = target.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(target.w / 2, target.h / 2);
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
    const canvas = renderScaled(bitmap, s);
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
  const targetPixels = Math.max(maxBytes * 14, 60_000);
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
    const canvas = renderScaled(bitmap, 0.25);
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

/**
 * Encode a JPEG whose size is strictly below maxBytes, keeping the original
 * pixel dimensions whenever possible. Only downscales when even the lowest
 * usable quality cannot fit.
 */
export async function compressBelow(
  bitmap: ImageBitmap,
  maxBytes: number,
): Promise<CompressResult & { downscaled: boolean }> {
  const encode = async (scale: number, q: number) => {
    const canvas = renderScaled(bitmap, scale);
    const blob = await canvasToBlob(canvas, q);
    return { blob, sizeKB: blob.size / 1024, width: canvas.width, height: canvas.height, quality: q };
  };

  // Pass 1: full resolution, binary search on quality.
  let lo = 0.3;
  let hi = 0.97;
  let best: CompressResult | null = null;
  for (let i = 0; i < 9; i++) {
    const q = (lo + hi) / 2;
    const r = await encode(1, q);
    if (r.blob.size < maxBytes) {
      if (!best || r.blob.size > best.blob.size) best = r;
      lo = q;
    } else {
      hi = q;
    }
  }
  if (best) return { ...best, downscaled: false };

  // Pass 2: shrink progressively, still preferring the highest quality that fits.
  let scale = 0.9;
  while (scale > 0.05) {
    let l = 0.3;
    let h = 0.95;
    let localBest: CompressResult | null = null;
    for (let i = 0; i < 7; i++) {
      const q = (l + h) / 2;
      const r = await encode(scale, q);
      if (r.blob.size < maxBytes) {
        if (!localBest || r.blob.size > localBest.blob.size) localBest = r;
        l = q;
      } else {
        h = q;
      }
    }
    if (localBest) return { ...localBest, downscaled: true };
    scale *= 0.8;
  }

  const last = await encode(0.05, 0.3);
  return { ...last, downscaled: true };
}
