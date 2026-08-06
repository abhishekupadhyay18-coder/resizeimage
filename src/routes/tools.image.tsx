import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Crop as CropIcon,
  Download,
  Droplet,
  Image as ImageI,
  Loader2,
  Palette,
  Redo2,
  RotateCcw,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Type,
  Undo2,
  Upload,
  Wand2,
  Wand,
} from "lucide-react";
import { toast } from "sonner";
import { ToolShell } from "@/components/ToolShell";
import {
  applyCssFilter,
  bitmapToCanvas,
  canvasToBlob,
  denoiseCanvas,
  flipCanvas,
  resizeCanvas,
  sharpenCanvas,
} from "@/lib/image-filters";
import {
  rotateBitmap,
  cropBitmap,
  compressBelow,
  loadBitmap,
} from "@/lib/compress-image";
import { CropPreview } from "@/components/CropPreview";
import { CameraCapture } from "@/components/CameraCapture";
import { downloadBlob } from "@/lib/pdf-utils";
import {
  TextLayer,
  TextBoxControls,
  drawTextBoxes,
  type TextBox,
} from "@/components/image/TextLayer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tools/image")({
  head: () => ({
    meta: [
      { title: "Image Tools — Transform, Edit & Enhance" },
      {
        name: "description",
        content:
          "Crop, rotate, add text, adjust colours and compress images to an exact KB size — all in your browser.",
      },
      { property: "og:title", content: "Image Tools" },
      {
        property: "og:description",
        content: "Client-side image editor: transform, text, filters, adjustments and compression.",
      },
    ],
  }),
  component: Page,
});

type Tool =
  | "cropedit"
  | "transform"
  | "text"
  | "bright"
  | "color"
  | "sharpen"
  | "blur"
  | "denoise"
  | "compress"
  | "convert";

const TOOLS: { key: Tool; label: string; icon: typeof CropIcon }[] = [
  { key: "cropedit", label: "Crop & Rotate", icon: ScanLine },
  { key: "transform", label: "Transform", icon: Wand },
  { key: "text", label: "Add text", icon: Type },
  { key: "bright", label: "Bright / Contrast", icon: Sun },
  { key: "color", label: "Colour", icon: Palette },
  { key: "sharpen", label: "Sharpen", icon: Wand2 },
  { key: "blur", label: "Blur", icon: Droplet },
  { key: "denoise", label: "Denoise", icon: SlidersHorizontal },
  { key: "compress", label: "Compress", icon: Sparkles },
  { key: "convert", label: "Convert", icon: ImageI },
];

function Page() {
  const [tool, setTool] = useState<Tool>("cropedit");
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<ImageBitmap[]>([]);
  const [idx, setIdx] = useState(-1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterCss, setFilterCss] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const bitmap = idx >= 0 ? history[idx] : null;

  // Keep a single preview URL in sync with the current bitmap.
  useEffect(() => {
    if (!bitmap) return;
    let cancelled = false;
    (async () => {
      const blob = await canvasToBlob(bitmapToCanvas(bitmap), "image/png");
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setPreviewUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [bitmap]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const push = useCallback(
    (bmp: ImageBitmap) => {
      setHistory((h) => [...h.slice(0, idx + 1), bmp]);
      setIdx((i) => i + 1);
      setFilterCss(null);
    },
    [idx],
  );

  const pushCanvas = useCallback(
    async (canvas: HTMLCanvasElement) => {
      push(await createImageBitmap(canvas));
    },
    [push],
  );

  const load = async (f: File) => {
    try {
      setError(null);
      const bmp = await loadBitmap(f);
      setFile(f);
      setHistory([bmp]);
      setIdx(0);
      setFilterCss(null);
    } catch {
      setError("Could not read this image.");
    }
  };

  const reset = () => {
    setFile(null);
    setHistory([]);
    setIdx(-1);
    setPreviewUrl(null);
    setFilterCss(null);
  };

  const panelProps = { bitmap: bitmap!, onResult: pushCanvas, setPreview: setFilterCss };

  const [boxes, setBoxes] = useState<TextBox[]>([]);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);

  const applyText = async () => {
    if (!bitmap || boxes.length === 0) return;
    const c = bitmapToCanvas(bitmap);
    drawTextBoxes(c, boxes);
    await pushCanvas(c);
    setBoxes([]);
    setSelectedBox(null);
    toast.success("Text applied");
  };

  const current = boxes.find((b) => b.id === selectedBox) ?? null;

  return (
    <ToolShell
      title="Image Tools"
      description="One image, every tool. Everything runs on your device."
    >
      {!file ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-12 text-center transition hover:bg-muted"
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
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) load(f);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-12 text-primary transition hover:bg-primary/10"
          >
            <Camera className="h-6 w-6" />
            <span className="text-sm font-semibold">Capture from camera</span>
            <span className="text-[11px] text-muted-foreground">Live preview, rear camera</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_230px]">
          {/* Left: the single working image */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={idx <= 0}
                onClick={() => {
                  setIdx((i) => Math.max(0, i - 1));
                  setFilterCss(null);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
              <button
                type="button"
                disabled={idx >= history.length - 1}
                onClick={() => {
                  setIdx((i) => Math.min(history.length - 1, i + 1));
                  setFilterCss(null);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
              >
                <Redo2 className="h-3.5 w-3.5" /> Redo
              </button>
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => {
                  setIdx(0);
                  setFilterCss(null);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Original
              </button>
              {bitmap && (
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {bitmap.width} × {bitmap.height}
                </span>
              )}
            </div>

            {previewUrl && bitmap && (
              <>
                {tool === "cropedit" || tool === "transform" ? (
                  <CropPreview
                    url={previewUrl}
                    naturalWidth={bitmap.width}
                    naturalHeight={bitmap.height}
                    onApplyCrop={async (r) => pushCanvas(bitmapToCanvas(await cropBitmap(bitmap, r)))}
                    onReset={() => setIdx(0)}
                    onRotateLeft={async () =>
                      pushCanvas(bitmapToCanvas(await rotateBitmap(bitmap, -90)))
                    }
                    onRotateRight={async () =>
                      pushCanvas(bitmapToCanvas(await rotateBitmap(bitmap, 90)))
                    }
                    onRotateFine={async (d) =>
                      pushCanvas(bitmapToCanvas(await rotateBitmap(bitmap, d)))
                    }
                  />
                ) : tool === "text" ? (
                  <TextLayer
                    url={previewUrl}
                    boxes={boxes}
                    onChange={setBoxes}
                    selectedId={selectedBox}
                    onSelect={setSelectedBox}
                  />
                ) : (
                  <div className="rounded-md border border-border bg-muted p-2 text-center">
                    <img
                      src={previewUrl}
                      alt="working image"
                      style={filterCss ? { filter: filterCss } : undefined}
                      className="mx-auto max-h-[70vh] w-auto object-contain"
                    />
                  </div>
                )}
              </>
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
              <button
                type="button"
                onClick={async () => {
                  if (!bitmap) return;
                  const blob = await canvasToBlob(bitmapToCanvas(bitmap), "image/png");
                  downloadBlob(blob, "edited.png");
                }}
                className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-3.5 w-3.5" /> Download current
              </button>
            </div>

            {error && <div className="text-xs text-destructive">{error}</div>}
          </div>

          {/* Right: tool rail + active panel */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5 md:grid-cols-2">
              {TOOLS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTool(t.key);
                    setFilterCss(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-[10px] font-medium transition",
                    tool === t.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <t.icon className="h-4 w-4" strokeWidth={1.75} />
                  <span className="leading-tight">{t.label}</span>
                </button>
              ))}
            </div>

            {bitmap && (
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                {tool === "cropedit" && (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <h3 className="text-sm font-semibold text-foreground">Crop &amp; Rotate</h3>
                    Drag the corners on the image, use the rotation slider, then press Apply.
                    <Row>
                      <Btn onClick={async () => pushCanvas(await flipCanvas(bitmap, "h"))}>
                        Flip H
                      </Btn>
                      <Btn onClick={async () => pushCanvas(await flipCanvas(bitmap, "v"))}>
                        Flip V
                      </Btn>
                    </Row>
                  </div>
                )}
                {tool === "transform" && <TransformPanel {...panelProps} />}
                {tool === "text" && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Add text</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Double-click the image to add a text box. Drag to move, use the corner dot to
                      resize, and edit the words below.
                    </p>
                    {current ? (
                      <TextBoxControls
                        box={current}
                        onChange={(nb) => setBoxes(boxes.map((b) => (b.id === nb.id ? nb : b)))}
                        onDelete={() => {
                          setBoxes(boxes.filter((b) => b.id !== current.id));
                          setSelectedBox(null);
                        }}
                      />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Select a text box to edit it.
                      </p>
                    )}
                    <Btn onClick={applyText} disabled={boxes.length === 0}>
                      Apply text to image
                    </Btn>
                  </div>
                )}
                {tool === "bright" && <BrightPanel {...panelProps} />}
                {tool === "color" && <ColorPanel {...panelProps} />}
                {tool === "sharpen" && <SharpenPanel {...panelProps} />}
                {tool === "blur" && <BlurPanel {...panelProps} />}
                {tool === "denoise" && <DenoisePanel {...panelProps} />}
                {tool === "compress" && <CompressPanel bitmap={bitmap} />}
                {tool === "convert" && (
                  <ConvertPanel bitmap={bitmap} originalName={file.name} />
                )}
              </div>
            )}
          </div>
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

interface PanelProps {
  bitmap: ImageBitmap;
  onResult: (c: HTMLCanvasElement) => Promise<void> | void;
  setPreview: (css: string | null) => void;
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

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground">
        {label}: {value}
        {suffix}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-primary"
      />
    </div>
  );
}

function TransformPanel({ bitmap, onResult }: PanelProps) {
  const [w, setW] = useState(bitmap.width);
  const [h, setH] = useState(bitmap.height);
  const [lock, setLock] = useState(true);
  const ratio = bitmap.width / bitmap.height;

  useEffect(() => {
    setW(bitmap.width);
    setH(bitmap.height);
  }, [bitmap]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Transform</h3>
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground">Resize</div>
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
              className="ml-1 w-20 rounded border border-input bg-background px-2 py-1 text-xs"
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
              className="ml-1 w-20 rounded border border-input bg-background px-2 py-1 text-xs"
            />
          </label>
        </Row>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
          lock ratio
        </label>
        <Btn onClick={async () => onResult(await resizeCanvas(bitmap, w, h))}>Apply resize</Btn>
      </div>
      <div className="space-y-2 border-t border-border pt-2">
        <div className="text-[11px] font-semibold text-muted-foreground">Rotate &amp; flip</div>
        <Row>
          <Btn onClick={async () => onResult(bitmapToCanvas(await rotateBitmap(bitmap, -90)))}>
            ⟲ 90°
          </Btn>
          <Btn onClick={async () => onResult(bitmapToCanvas(await rotateBitmap(bitmap, 90)))}>
            ⟳ 90°
          </Btn>
          <Btn onClick={async () => onResult(await flipCanvas(bitmap, "h"))}>Flip H</Btn>
          <Btn onClick={async () => onResult(await flipCanvas(bitmap, "v"))}>Flip V</Btn>
        </Row>
        <p className="text-[11px] text-muted-foreground">
          Fine-degree rotation and cropping live in the Crop &amp; Rotate tool.
        </p>
      </div>
    </div>
  );
}

function BrightPanel({ bitmap, onResult, setPreview }: PanelProps) {
  const [b, setB] = useState(100);
  const [c, setC] = useState(100);
  const css = `brightness(${b}%) contrast(${c}%)`;
  useEffect(() => {
    setPreview(b === 100 && c === 100 ? null : css);
  }, [b, c, css, setPreview]);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Brightness / Contrast</h3>
      <Slider label="Brightness" value={b} min={0} max={200} onChange={setB} suffix="%" />
      <Slider label="Contrast" value={c} min={0} max={200} onChange={setC} suffix="%" />
      <Row>
        <Btn onClick={async () => onResult(await applyCssFilter(bitmap, css))}>Apply</Btn>
        <Btn
          onClick={() => {
            setB(100);
            setC(100);
          }}
        >
          Reset
        </Btn>
        <Btn
          onClick={() => {
            setB(108);
            setC(115);
          }}
        >
          Auto
        </Btn>
      </Row>
    </div>
  );
}

function ColorPanel({ bitmap, onResult, setPreview }: PanelProps) {
  const [sat, setSat] = useState(100);
  const [hue, setHue] = useState(0);
  const [gray, setGray] = useState(0);
  const css = `saturate(${sat}%) hue-rotate(${hue}deg) grayscale(${gray}%)`;
  useEffect(() => {
    setPreview(sat === 100 && hue === 0 && gray === 0 ? null : css);
  }, [sat, hue, gray, css, setPreview]);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Colour</h3>
      <Slider label="Saturation" value={sat} min={0} max={300} onChange={setSat} suffix="%" />
      <Slider label="Hue" value={hue} min={0} max={360} onChange={setHue} suffix="°" />
      <Slider label="Grayscale" value={gray} min={0} max={100} onChange={setGray} suffix="%" />
      <Row>
        <Btn onClick={async () => onResult(await applyCssFilter(bitmap, css))}>Apply</Btn>
        <Btn
          onClick={() => {
            setSat(100);
            setHue(0);
            setGray(0);
          }}
        >
          Reset
        </Btn>
      </Row>
    </div>
  );
}

function BlurPanel({ bitmap, onResult, setPreview }: PanelProps) {
  const [amt, setAmt] = useState(4);
  useEffect(() => {
    setPreview(amt === 0 ? null : `blur(${amt}px)`);
  }, [amt, setPreview]);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Blur</h3>
      <Slider label="Radius" value={amt} min={0} max={30} onChange={setAmt} suffix="px" />
      <Btn onClick={async () => onResult(await applyCssFilter(bitmap, `blur(${amt}px)`))}>
        Apply blur
      </Btn>
    </div>
  );
}

function SharpenPanel({ bitmap, onResult }: PanelProps) {
  const [amt, setAmt] = useState(1);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Sharpen</h3>
      <Slider label="Amount" value={amt} min={0.2} max={3} step={0.1} onChange={setAmt} />
      <Btn
        busy={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onResult(await sharpenCanvas(bitmap, amt));
          } finally {
            setBusy(false);
          }
        }}
      >
        Apply sharpen
      </Btn>
    </div>
  );
}

function DenoisePanel({ bitmap, onResult }: PanelProps) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Denoise</h3>
      <p className="text-[11px] text-muted-foreground">
        3×3 median filter. Slow on very large images.
      </p>
      <Btn
        busy={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onResult(await denoiseCanvas(bitmap));
          } finally {
            setBusy(false);
          }
        }}
      >
        Apply denoise
      </Btn>
    </div>
  );
}

const KB_PRESETS = [20, 30, 50, 100];

function CompressPanel({ bitmap }: { bitmap: ImageBitmap }) {
  const [targetKB, setTargetKB] = useState<number>(50);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const target = useMemo(() => {
    const c = parseFloat(custom);
    return custom && !Number.isNaN(c) && c > 0 ? c : targetKB;
  }, [custom, targetKB]);

  const run = async () => {
    setBusy(true);
    setInfo(null);
    try {
      const r = await compressBelow(bitmap, target * 1024);
      setInfo(
        `${r.sizeKB.toFixed(1)} KB · ${r.width}×${r.height}${
          r.downscaled ? " (had to downscale to fit)" : " · original size kept"
        }`,
      );
      downloadBlob(r.blob, `compressed-${Math.round(target)}kb.jpg`);
      toast.success(`Compressed to ${r.sizeKB.toFixed(1)} KB`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Compress</h3>
      <p className="text-[11px] text-muted-foreground">
        Output is always strictly below the chosen size, at the best possible quality.
      </p>
      <Row>
        {KB_PRESETS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTargetKB(k);
              setCustom("");
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium",
              !custom && targetKB === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent",
            )}
          >
            {k} KB
          </button>
        ))}
      </Row>
      <label className="block text-[11px] text-muted-foreground">
        Custom (KB)
        <input
          type="number"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="e.g. 75"
          className="mt-1 w-24 rounded border border-input bg-background px-2 py-1 text-xs"
        />
      </label>
      <Btn onClick={run} busy={busy}>
        Compress below {Math.round(target)} KB
      </Btn>
      {info && <div className="text-[11px] text-muted-foreground">{info}</div>}
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
          <button
            key={k}
            type="button"
            onClick={() => setT(k)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium",
              t === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent",
            )}
          >
            {k.toUpperCase()}
          </button>
        ))}
      </Row>
      <Btn
        onClick={async () => {
          const c = bitmapToCanvas(bitmap);
          const blob = await canvasToBlob(c, `image/${t}`, 0.95);
          const base = originalName.replace(/\.[^.]+$/, "");
          downloadBlob(blob, `${base}.${t === "jpeg" ? "jpg" : t}`);
        }}
      >
        Convert &amp; download
      </Btn>
    </div>
  );
}
