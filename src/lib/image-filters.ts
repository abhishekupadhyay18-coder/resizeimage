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
