// Client-only scan-style image enhancements. Operates on ImageBitmap → Canvas.

export type EnhanceMode = "original" | "auto" | "magic" | "bw" | "gray";

function bmpCanvas(bmp: ImageBitmap): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  return c;
}

// White-balance via grayscale-world assumption + auto contrast stretch (per channel).
function autoLevels(img: ImageData, saturation = 1): void {
  const d = img.data;
  const n = d.length;
  // Per-channel histogram
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < n; i += 4) {
    hist[0][d[i]]++;
    hist[1][d[i + 1]]++;
    hist[2][d[i + 2]]++;
  }
  const total = n / 4;
  const clip = total * 0.005; // ignore 0.5% tails
  const bounds: [number, number][] = [];
  for (let c = 0; c < 3; c++) {
    let acc = 0, lo = 0, hi = 255;
    for (let v = 0; v < 256; v++) { acc += hist[c][v]; if (acc > clip) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[c][v]; if (acc > clip) { hi = v; break; } }
    bounds.push([lo, Math.max(lo + 1, hi)]);
  }
  for (let i = 0; i < n; i += 4) {
    for (let c = 0; c < 3; c++) {
      const [lo, hi] = bounds[c];
      let v = ((d[i + c] - lo) * 255) / (hi - lo);
      if (v < 0) v = 0; else if (v > 255) v = 255;
      d[i + c] = v;
    }
    if (saturation !== 1) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      d[i] = Math.max(0, Math.min(255, gray + (r - gray) * saturation));
      d[i + 1] = Math.max(0, Math.min(255, gray + (g - gray) * saturation));
      d[i + 2] = Math.max(0, Math.min(255, gray + (b - gray) * saturation));
    }
  }
}

function grayscale(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  }
}

// Adaptive threshold (mean-of-window with bias) for scanned-document B&W.
function adaptiveBW(img: ImageData, windowSize = 25, bias = 10): void {
  const w = img.width, h = img.height, d = img.data;
  // Luminance
  const lum = new Float32Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    lum[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  // Integral image
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += lum[y * w + x];
      ii[(y + 1) * (w + 1) + (x + 1)] = ii[y * (w + 1) + (x + 1)] + rowSum;
    }
  }
  const r = Math.max(1, Math.floor(windowSize / 2));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        ii[(y1 + 1) * (w + 1) + (x1 + 1)] -
        ii[y0 * (w + 1) + (x1 + 1)] -
        ii[(y1 + 1) * (w + 1) + x0] +
        ii[y0 * (w + 1) + x0];
      const mean = sum / area;
      const idx = (y * w + x) * 4;
      const v = lum[y * w + x] < mean - bias ? 0 : 255;
      d[idx] = d[idx + 1] = d[idx + 2] = v;
    }
  }
}

// Mild unsharp mask via 3x3 sharpen kernel.
function sharpen(img: ImageData, amount = 0.6): ImageData {
  const w = img.width, h = img.height, s = img.data;
  const out = new ImageData(w, h);
  const d = out.data;
  const a = amount;
  const k = [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          const kk = k[(ky + 1) * 3 + (kx + 1)];
          const p = (py * w + px) * 4;
          r += s[p] * kk;
          g += s[p + 1] * kk;
          b += s[p + 2] * kk;
        }
      }
      const p = (y * w + x) * 4;
      d[p] = Math.max(0, Math.min(255, r));
      d[p + 1] = Math.max(0, Math.min(255, g));
      d[p + 2] = Math.max(0, Math.min(255, b));
      d[p + 3] = s[p + 3];
    }
  }
  return out;
}

export async function enhance(
  bmp: ImageBitmap,
  mode: EnhanceMode,
): Promise<HTMLCanvasElement> {
  const c = bmpCanvas(bmp);
  if (mode === "original") return c;
  const ctx = c.getContext("2d")!;
  let img = ctx.getImageData(0, 0, c.width, c.height);
  if (mode === "auto") {
    autoLevels(img, 1);
    img = sharpen(img, 0.5);
  } else if (mode === "magic") {
    autoLevels(img, 1.35);
    img = sharpen(img, 0.6);
  } else if (mode === "gray") {
    autoLevels(img, 1);
    grayscale(img);
  } else if (mode === "bw") {
    autoLevels(img, 1);
    adaptiveBW(img, 25, 10);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function canvasToJpegBlob(c: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", quality),
  );
}
