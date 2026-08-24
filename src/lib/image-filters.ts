// Canvas-based image filters, all client-side.

export function bitmapToCanvas(bmp: ImageBitmap): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  return c;
}

export async function canvasToBitmap(c: HTMLCanvasElement): Promise<ImageBitmap> {
  return await createImageBitmap(c);
}

export function canvasToBlob(
  c: HTMLCanvasElement,
  type = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, quality),
  );
}

export async function applyCssFilter(
  bmp: ImageBitmap,
  filter: string,
): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d")!;
  ctx.filter = filter;
  ctx.drawImage(bmp, 0, 0);
  return c;
}

export async function flipCanvas(
  bmp: ImageBitmap,
  axis: "h" | "v",
): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d")!;
  if (axis === "h") {
    ctx.translate(bmp.width, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, bmp.height);
    ctx.scale(1, -1);
  }
  ctx.drawImage(bmp, 0, 0);
  return c;
}

export async function resizeCanvas(
  bmp: ImageBitmap,
  w: number,
  h: number,
): Promise<HTMLCanvasElement> {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

// 3x3 convolution with clamped edges.
export function convolve3x3(
  src: ImageData,
  kernel: number[],
  divisor = 1,
  bias = 0,
): ImageData {
  const w = src.width;
  const h = src.height;
  const s = src.data;
  const out = new ImageData(w, h);
  const d = out.data;
  const idx = (x: number, y: number) => (y * w + x) * 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const k = kernel[(ky + 1) * 3 + (kx + 1)];
          const p = idx(px, py);
          r += s[p] * k;
          g += s[p + 1] * k;
          b += s[p + 2] * k;
        }
      }
      const p = idx(x, y);
      d[p] = Math.min(255, Math.max(0, r / divisor + bias));
      d[p + 1] = Math.min(255, Math.max(0, g / divisor + bias));
      d[p + 2] = Math.min(255, Math.max(0, b / divisor + bias));
      d[p + 3] = s[p + 3];
    }
  }
  return out;
}

export async function sharpenCanvas(bmp: ImageBitmap, amount = 1): Promise<HTMLCanvasElement> {
  const c = bitmapToCanvas(bmp);
  const ctx = c.getContext("2d")!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const a = amount;
  const kernel = [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0];
  ctx.putImageData(convolve3x3(img, kernel), 0, 0);
  return c;
}

// Simple 3x3 median filter for denoise (pretty slow — call on modest images).
export async function denoiseCanvas(bmp: ImageBitmap): Promise<HTMLCanvasElement> {
  const c = bitmapToCanvas(bmp);
  const ctx = c.getContext("2d")!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const w = img.width;
  const h = img.height;
  const s = img.data;
  const out = new ImageData(w, h);
  const d = out.data;
  const rN: number[] = new Array(9);
  const gN: number[] = new Array(9);
  const bN: number[] = new Array(9);
  const sorter = (a: number, b: number) => a - b;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const p = (py * w + px) * 4;
          rN[n] = s[p];
          gN[n] = s[p + 1];
          bN[n] = s[p + 2];
          n++;
        }
      }
      rN.sort(sorter);
      gN.sort(sorter);
      bN.sort(sorter);
      const p = (y * w + x) * 4;
      d[p] = rN[4];
      d[p + 1] = gN[4];
      d[p + 2] = bN[4];
      d[p + 3] = s[p + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

/** Unsharp-mask sharpening. `amount` 0..3, applied via a 3x3 kernel. */
export async function unsharpMask(
  bmp: ImageBitmap,
  amount: number,
): Promise<HTMLCanvasElement> {
  const c = bitmapToCanvas(bmp);
  if (amount <= 0.01) return c;
  const ctx = c.getContext("2d")!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const a = amount;
  const kernel = [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0];
  ctx.putImageData(convolve3x3(img, kernel), 0, 0);
  return c;
}

/**
 * Blur only the areas painted white in `mask` (same size as the image).
 * Everything else stays pixel-identical.
 */
export async function regionBlurCanvas(
  bmp: ImageBitmap,
  mask: HTMLCanvasElement,
  radius: number,
): Promise<HTMLCanvasElement> {
  const base = bitmapToCanvas(bmp);
  if (radius <= 0) return base;

  // 1. Blurred copy of the whole image.
  const blurred = document.createElement("canvas");
  blurred.width = base.width;
  blurred.height = base.height;
  const bctx = blurred.getContext("2d")!;
  bctx.filter = `blur(${radius}px)`;
  bctx.drawImage(base, 0, 0);
  bctx.filter = "none";

  // 2. Keep only the masked part of the blurred copy.
  bctx.globalCompositeOperation = "destination-in";
  bctx.drawImage(mask, 0, 0, base.width, base.height);
  bctx.globalCompositeOperation = "source-over";

  // 3. Stamp it back over the original.
  const ctx = base.getContext("2d")!;
  ctx.drawImage(blurred, 0, 0);
  return base;
}

/**
 * Edge-preserving (bilateral-style) denoise. `strength` 0..1 controls how
 * aggressively similar pixels are averaged; `detail` 0..1 adds a light
 * sharpening pass afterwards so text edges survive.
 */
export async function bilateralDenoise(
  bmp: ImageBitmap,
  strength = 0.6,
  detail = 0.35,
): Promise<HTMLCanvasElement> {
  const c = bitmapToCanvas(bmp);
  const ctx = c.getContext("2d")!;
  const w = c.width;
  const h = c.height;
  const src = ctx.getImageData(0, 0, w, h);
  const s = src.data;
  const out = ctx.createImageData(w, h);
  const d = out.data;

  const radius = strength > 0.66 ? 2 : 1;
  // Larger sigma → more smoothing of similar tones, edges still preserved.
  const sigmaR = 12 + strength * 48;
  const inv2s2 = 1 / (2 * sigmaR * sigmaR);
  const spatial: number[] = [];
  const sigmaS = radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      spatial.push(Math.exp(-(dx * dx + dy * dy) / (2 * sigmaS * sigmaS)));
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const lc = 0.299 * s[p] + 0.587 * s[p + 1] + 0.114 * s[p + 2];
      let wsum = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let k = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const py = y + dy < 0 ? 0 : y + dy > h - 1 ? h - 1 : y + dy;
        for (let dx = -radius; dx <= radius; dx++) {
          const px = x + dx < 0 ? 0 : x + dx > w - 1 ? w - 1 : x + dx;
          const q = (py * w + px) * 4;
          const lq = 0.299 * s[q] + 0.587 * s[q + 1] + 0.114 * s[q + 2];
          const diff = lq - lc;
          const weight = spatial[k++] * Math.exp(-(diff * diff) * inv2s2);
          wsum += weight;
          r += s[q] * weight;
          g += s[q + 1] * weight;
          b += s[q + 2] * weight;
        }
      }
      d[p] = r / wsum;
      d[p + 1] = g / wsum;
      d[p + 2] = b / wsum;
      d[p + 3] = s[p + 3];
    }
  }
  ctx.putImageData(out, 0, 0);

  if (detail > 0.02) {
    const img = ctx.getImageData(0, 0, w, h);
    const a = detail * 0.8;
    ctx.putImageData(
      convolve3x3(img, [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]),
      0,
      0,
    );
  }
  return c;
}
