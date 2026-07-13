import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Crop as CropIcon,
  Droplet,
  Image as ImageI,
  Loader2,
  Palette,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Type,
  Upload,
  Wand2,
  Wand,
} from "lucide-react";
import { ToolShell } from "@/components/ToolShell";
import { ServiceTile } from "@/components/ServiceTile";
import {
  applyCssFilter,
  bitmapToCanvas,
  canvasToBlob,
  denoiseCanvas,
  flipCanvas,
  resizeCanvas,
  sharpenCanvas,
} from "@/lib/image-filters";
import { rotateBitmap, cropBitmap, compressToRange, loadBitmap } from "@/lib/compress-image";
import { CropPreview } from "@/components/CropPreview";
import { CameraCapture } from "@/components/CameraCapture";
import { downloadBlob } from "@/lib/pdf-utils";

export const Route = createFileRoute("/tools/image")({
  head: () => ({
    meta: [
      { title: "Image Tools — Transform, Edit & Enhance" },
      {
        name: "description",
        content: "Resize, crop, rotate, flip, filter and adjust images entirely in your browser.",
      },
      { property: "og:title", content: "Image Tools" },
      {
        property: "og:description",
        content: "Client-side image editor: transform, filter, adjust and enhance.",
      },
    ],
  }),
  component: Page,
});

type Tool =
  | "transform"
  | "cropedit"
  | "compress"
  | "convert"
  | "text"
  | "blur"
  | "sharpen"
  | "bright"
  | "color"
  | "denoise";

const TOOLS: { key: Tool; label: string; icon: typeof CropIcon }[] = [
  { key: "cropedit", label: "Crop, Edit & Rotate", icon: ScanLine },
  { key: "transform", label: "Transform", icon: Wand },
  { key: "compress", label: "Compress", icon: Sparkles },
  { key: "convert", label: "Convert", icon: ImageI },
  { key: "text", label: "Add text", icon: Type },
  { key: "blur", label: "Blur", icon: Droplet },
  { key: "sharpen", label: "Sharpen", icon: Wand2 },
  { key: "bright", label: "Bright / Contrast", icon: Sun },
  { key: "color", label: "Color", icon: Palette },
  { key: "denoise", label: "Denoise", icon: SlidersHorizontal },
];

function Page() {
  const [tool, setTool] = useState<Tool>("cropedit");
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const load = async (f: File) => {
    try {
      setError(null);
      const bmp = await loadBitmap(f);
      setFile(f);
      setBitmap(bmp);
      const url = URL.createObjectURL(f);
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch {
      setError("Could not read this image.");
    }
  };

  const setResult = async (canvas: HTMLCanvasElement) => {
    const bmp = await createImageBitmap(canvas);
    setBitmap(bmp);
    const blob = await canvasToBlob(canvas, "image/png");
    const url = URL.createObjectURL(blob);
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
  };

  const reset = () => {
    setFile(null);
    setBitmap(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  return (
    <ToolShell title="Image Tools" description="Client-side image editor.">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {TOOLS.map((t) => (
          <ServiceTile
            key={t.key}
            active={tool === t.key}
            onClick={() => setTool(t.key)}
            title={t.label}
            icon={t.icon}
          />
        ))}
      </div>

      {!file ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-10 text-center hover:bg-muted"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) load(f);
            }}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="mt-2 text-sm font-medium">Drop or click to pick an image</div>
            <div className="text-xs text-muted-foreground">JPG, PNG, WEBP and more</div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); }}
            />
          </label>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-10 text-primary hover:bg-primary/10"
          >
            <Camera className="h-6 w-6" />
            <span className="text-sm font-semibold">Capture from camera</span>
            <span className="text-[11px] text-muted-foreground">Live preview, rear camera</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {previewUrl && (
            <div className="rounded-md border border-border bg-muted p-2 text-center">
              <img src={previewUrl} alt="preview" className="mx-auto max-h-96 w-auto object-contain" />
              {bitmap && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {bitmap.width} × {bitmap.height}
                </div>
              )}
            </div>
          )}

          {bitmap && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              {tool === "cropedit" && previewUrl && (
                <CropEditPanel bitmap={bitmap} previewUrl={previewUrl} onResult={setResult} />
              )}
              {tool === "transform" && previewUrl && (
                <TransformPanel bitmap={bitmap} previewUrl={previewUrl} onResult={setResult} />
              )}
              {tool === "compress" && <CompressPanel bitmap={bitmap} />}
              {tool === "convert" && <ConvertPanel bitmap={bitmap} originalName={file.name} />}
              {tool === "text" && <TextPanel bitmap={bitmap} onResult={setResult} />}
              {tool === "blur" && <FilterPanel bitmap={bitmap} onResult={setResult} />}
              {tool === "sharpen" && <SharpenPanel bitmap={bitmap} onResult={setResult} />}
              {tool === "bright" && <BrightPanel bitmap={bitmap} onResult={setResult} />}
              {tool === "color" && <ColorPanel bitmap={bitmap} onResult={setResult} />}
              {tool === "denoise" && <DenoisePanel bitmap={bitmap} onResult={setResult} />}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Choose another image
            </button>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Camera className="h-3.5 w-3.5" /> Recapture
            </button>
            <a
              href={previewUrl ?? "#"}
              download="edited.png"
              className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Download current
            </a>
          </div>

          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>
      )}

      {cameraOpen && (
        <CameraCapture
          onCapture={(f) => {
            setCameraOpen(false);
            load(f);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </ToolShell>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function Btn({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

// Merged crop / rotate / flip editor (same UX as Document Image Compressor).
function CropEditPanel({
  bitmap,
  previewUrl,
  onResult,
}: {
  bitmap: ImageBitmap;
  previewUrl: string;
  onResult: (c: HTMLCanvasElement) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Crop, Edit &amp; Rotate</h3>
      <CropPreview
        url={previewUrl}
        naturalWidth={bitmap.width}
        naturalHeight={bitmap.height}
        onApplyCrop={async (r) => onResult(bitmapToCanvas(await cropBitmap(bitmap, r)))}
        onReset={() => undefined}
        onRotateLeft={async () => onResult(bitmapToCanvas(await rotateBitmap(bitmap, -90)))}
        onRotateRight={async () => onResult(bitmapToCanvas(await rotateBitmap(bitmap, 90)))}
        onRotateFine={async (d) => onResult(bitmapToCanvas(await rotateBitmap(bitmap, d)))}
      />
      <Row>
        <Btn onClick={async () => onResult(await flipCanvas(bitmap, "h"))}>Flip horizontal</Btn>
        <Btn onClick={async () => onResult(await flipCanvas(bitmap, "v"))}>Flip vertical</Btn>
      </Row>
    </div>
  );
}

// Combined Resize + Crop + Rotate + Flip in a single tool.
function TransformPanel({
  bitmap,
  previewUrl,
  onResult,
}: {
  bitmap: ImageBitmap;
  previewUrl: string;
  onResult: (c: HTMLCanvasElement) => void;
}) {
  const [w, setW] = useState(bitmap.width);
  const [h, setH] = useState(bitmap.height);
  const [lock, setLock] = useState(true);
  const ratio = bitmap.width / bitmap.height;

  useEffect(() => {
    setW(bitmap.width);
    setH(bitmap.height);
  }, [bitmap]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Transform</h3>

      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
        <div className="text-xs font-semibold text-muted-foreground">Resize</div>
        <Row>
          <label className="text-xs">
            W{" "}
            <input
              type="number"
              value={w}
              onChange={(e) => {
                const v = +e.target.value;
                setW(v);
                if (lock) setH(Math.round(v / ratio));
              }}
              className="ml-1 w-24 rounded border border-input bg-background px-2 py-1 text-xs"
            />
          </label>
          <label className="text-xs">
            H{" "}
            <input
              type="number"
              value={h}
              onChange={(e) => {
                const v = +e.target.value;
                setH(v);
                if (lock) setW(Math.round(v * ratio));
              }}
              className="ml-1 w-24 rounded border border-input bg-background px-2 py-1 text-xs"
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
            lock ratio
          </label>
          <Btn onClick={async () => onResult(await resizeCanvas(bitmap, w, h))}>Apply resize</Btn>
        </Row>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
        <div className="text-xs font-semibold text-muted-foreground">Crop &amp; rotate</div>
        <CropPreview
          url={previewUrl}
          naturalWidth={bitmap.width}
          naturalHeight={bitmap.height}
          onApplyCrop={async (r) => onResult(bitmapToCanvas(await cropBitmap(bitmap, r)))}
          onReset={() => undefined}
          onRotateLeft={async () => onResult(bitmapToCanvas(await rotateBitmap(bitmap, -90)))}
          onRotateRight={async () => onResult(bitmapToCanvas(await rotateBitmap(bitmap, 90)))}
          onRotateFine={async (d) => onResult(bitmapToCanvas(await rotateBitmap(bitmap, d)))}
        />
      </div>

      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
        <div className="text-xs font-semibold text-muted-foreground">Flip</div>
        <Row>
          <Btn onClick={async () => onResult(await flipCanvas(bitmap, "h"))}>Flip horizontal</Btn>
          <Btn onClick={async () => onResult(await flipCanvas(bitmap, "v"))}>Flip vertical</Btn>
        </Row>
      </div>
    </div>
  );
}

function CompressPanel({ bitmap }: { bitmap: ImageBitmap }) {
  const [quality, setQuality] = useState(0.8);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<number | null>(null);
  const [targetKB, setTargetKB] = useState<number | null>(null);

  const compressQ = async () => {
    setBusy(true);
    try {
      const c = bitmapToCanvas(bitmap);
      const blob = await canvasToBlob(c, "image/jpeg", quality);
      setSize(blob.size);
      downloadBlob(blob, "compressed.jpg");
    } finally { setBusy(false); }
  };
  const compressT = async () => {
    if (!targetKB) return;
    setBusy(true);
    try {
      const r = await compressToRange(bitmap, (targetKB - 5) * 1024, targetKB * 1024);
      setSize(r.blob.size);
      downloadBlob(r.blob, `compressed-${targetKB}kb.jpg`);
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Compress (JPEG)</h3>
      <div>
        <label className="text-xs text-muted-foreground">Quality: {quality.toFixed(2)}</label>
        <input type="range" min={0.1} max={1} step={0.05} value={quality} onChange={(e) => setQuality(+e.target.value)} className="w-full accent-primary" />
      </div>
      <Btn onClick={compressQ} busy={busy}>Download at quality</Btn>
      <div className="pt-2 border-t border-border">
        <label className="text-xs text-muted-foreground">Or target size (KB):</label>
        <Row>
          <input type="number" value={targetKB ?? ""} onChange={(e) => setTargetKB(e.target.value ? +e.target.value : null)} className="w-24 rounded border border-input bg-background px-2 py-1 text-xs" placeholder="e.g. 100" />
          <Btn onClick={compressT} busy={busy} disabled={!targetKB}>Compress to KB</Btn>
        </Row>
      </div>
      {size !== null && <div className="text-xs text-muted-foreground">Last output: {(size / 1024).toFixed(1)} KB</div>}
    </div>
  );
}

function ConvertPanel({ bitmap, originalName }: { bitmap: ImageBitmap; originalName: string }) {
  const [t, setT] = useState<"jpeg" | "png" | "webp">("jpeg");
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Convert format</h3>
      <Row>
        {(["jpeg", "png", "webp"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setT(k)} className={`rounded-full px-3 py-1 text-xs font-medium border ${t === k ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`}>{k === "jpeg" ? "JPEG" : k.toUpperCase()}</button>
        ))}
      </Row>
      <Btn onClick={async () => {
        const c = bitmapToCanvas(bitmap);
        const blob = await canvasToBlob(c, `image/${t}`, 0.95);
        const base = originalName.replace(/\.[^.]+$/, "");
        const ext = t === "jpeg" ? "jpg" : t;
        downloadBlob(blob, `${base}.${ext}`);
      }}>Convert & download</Btn>
    </div>
  );
}

function TextPanel({ bitmap, onResult }: { bitmap: ImageBitmap; onResult: (c: HTMLCanvasElement) => void }) {
  const [text, setText] = useState("Sample text");
  const [size, setSize] = useState(48);
  const [color, setColor] = useState("#ffffff");
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const apply = () => {
    const c = bitmapToCanvas(bitmap);
    const ctx = c.getContext("2d")!;
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = Math.max(2, size / 16);
    ctx.textBaseline = "top";
    const px = (x / 100) * c.width;
    const py = (y / 100) * c.height;
    ctx.strokeText(text, px, py);
    ctx.fillText(text, px, py);
    onResult(c);
  };
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Add text</h3>
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
      <Row>
        <label className="text-xs">Size <input type="number" value={size} onChange={(e) => setSize(+e.target.value)} className="ml-1 w-16 rounded border border-input bg-background px-2 py-1 text-xs" /></label>
        <label className="text-xs">Color <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="ml-1 h-6 w-10 align-middle" /></label>
      </Row>
      <div>
        <label className="text-xs text-muted-foreground">X: {x}%</label>
        <input type="range" min={0} max={100} value={x} onChange={(e) => setX(+e.target.value)} className="w-full accent-primary" />
        <label className="text-xs text-muted-foreground">Y: {y}%</label>
        <input type="range" min={0} max={100} value={y} onChange={(e) => setY(+e.target.value)} className="w-full accent-primary" />
      </div>
      <Btn onClick={apply}>Apply text</Btn>
    </div>
  );
}

function FilterPanel({ bitmap, onResult }: { bitmap: ImageBitmap; onResult: (c: HTMLCanvasElement) => void }) {
  const [amt, setAmt] = useState(4);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Blur</h3>
      <div>
        <label className="text-xs text-muted-foreground">Radius: {amt}px</label>
        <input type="range" min={0} max={30} value={amt} onChange={(e) => setAmt(+e.target.value)} className="w-full accent-primary" />
      </div>
      <Btn onClick={async () => onResult(await applyCssFilter(bitmap, `blur(${amt}px)`))}>Apply blur</Btn>
    </div>
  );
}

function SharpenPanel({ bitmap, onResult }: { bitmap: ImageBitmap; onResult: (c: HTMLCanvasElement) => void }) {
  const [amt, setAmt] = useState(1);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Sharpen</h3>
      <div>
        <label className="text-xs text-muted-foreground">Amount: {amt.toFixed(1)}</label>
        <input type="range" min={0.2} max={3} step={0.1} value={amt} onChange={(e) => setAmt(+e.target.value)} className="w-full accent-primary" />
      </div>
      <Btn busy={busy} onClick={async () => { setBusy(true); try { onResult(await sharpenCanvas(bitmap, amt)); } finally { setBusy(false); } }}>Apply sharpen</Btn>
    </div>
  );
}

function BrightPanel({ bitmap, onResult }: { bitmap: ImageBitmap; onResult: (c: HTMLCanvasElement) => void }) {
  const [b, setB] = useState(100);
  const [c, setC] = useState(100);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Brightness / Contrast</h3>
      <div>
        <label className="text-xs text-muted-foreground">Brightness: {b}%</label>
        <input type="range" min={0} max={200} value={b} onChange={(e) => setB(+e.target.value)} className="w-full accent-primary" />
        <label className="text-xs text-muted-foreground">Contrast: {c}%</label>
        <input type="range" min={0} max={200} value={c} onChange={(e) => setC(+e.target.value)} className="w-full accent-primary" />
      </div>
      <Btn onClick={async () => onResult(await applyCssFilter(bitmap, `brightness(${b}%) contrast(${c}%)`))}>Apply</Btn>
    </div>
  );
}

function ColorPanel({ bitmap, onResult }: { bitmap: ImageBitmap; onResult: (c: HTMLCanvasElement) => void }) {
  const [sat, setSat] = useState(100);
  const [hue, setHue] = useState(0);
  const [gray, setGray] = useState(0);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Color adjustments</h3>
      <div>
        <label className="text-xs text-muted-foreground">Saturation: {sat}%</label>
        <input type="range" min={0} max={300} value={sat} onChange={(e) => setSat(+e.target.value)} className="w-full accent-primary" />
        <label className="text-xs text-muted-foreground">Hue rotate: {hue}°</label>
        <input type="range" min={0} max={360} value={hue} onChange={(e) => setHue(+e.target.value)} className="w-full accent-primary" />
        <label className="text-xs text-muted-foreground">Grayscale: {gray}%</label>
        <input type="range" min={0} max={100} value={gray} onChange={(e) => setGray(+e.target.value)} className="w-full accent-primary" />
      </div>
      <Btn onClick={async () => onResult(await applyCssFilter(bitmap, `saturate(${sat}%) hue-rotate(${hue}deg) grayscale(${gray}%)`))}>Apply</Btn>
    </div>
  );
}

function DenoisePanel({ bitmap, onResult }: { bitmap: ImageBitmap; onResult: (c: HTMLCanvasElement) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Denoise (median filter)</h3>
      <p className="text-xs text-muted-foreground">Basic 3×3 median. Slow on very large images — consider resizing first.</p>
      <Btn busy={busy} onClick={async () => { setBusy(true); try { onResult(await denoiseCanvas(bitmap)); } finally { setBusy(false); } }}>Apply denoise</Btn>
    </div>
  );
}
