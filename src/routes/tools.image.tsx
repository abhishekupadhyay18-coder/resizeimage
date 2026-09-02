import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Download,
  Droplet,
  Image as ImageI,
  Loader2,
  Palette,
  Redo2,
  RotateCcw,
  ScanLine,
  Sun,
  Type,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ToolShell } from "@/components/ToolShell";
import {
  applyCssFilter,
  bitmapToCanvas,
  canvasToBlob,
  flipCanvas,
  regionBlurCanvas,
  resizeCanvas,
  unsharpMask,
} from "@/lib/image-filters";
import {
  rotateBitmap,
  rotateBitmapCropped,
  cropBitmap,
  compressBelow,
  loadBitmap,
  setJpegDpi,
} from "@/lib/compress-image";
import { CropPreview } from "@/components/CropPreview";
import { CameraCapture } from "@/components/CameraCapture";
import { BlurBrush } from "@/components/image/BlurBrush";
import { downloadBlob } from "@/lib/pdf-utils";
import {
  TextLayer,
  TextLayerList,
  TextBoxControls,
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
        content:
          "Client-side image editor: transform, text, filters, adjustments and compression.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type Tool = "crc" | "text" | "bright" | "color" | "blur" | "convert";

const TOOLS: { key: Tool; label: string; icon: typeof ScanLine }[] = [
  { key: "crc", label: "Crop, Rotate & Compress", icon: ScanLine },
  { key: "text", label: "Add text", icon: Type },
  { key: "bright", label: "Bright / Contrast", icon: Sun },
  { key: "color", label: "Colour", icon: Palette },
  { key: "blur", label: "Blur", icon: Droplet },
  { key: "convert", label: "Convert", icon: ImageI },
];

interface Adjust {
  brightness: number;
  contrast: number;
  exposure: number;
  highlights: number;
  sharpness: number;
  saturate: number;
  hue: number;
  gray: number;
}

const DEFAULT_ADJUST: Adjust = {
  brightness: 100,
  contrast: 100,
  exposure: 0,
  highlights: 0,
  sharpness: 0,
  saturate: 100,
  hue: 0,
  gray: 0,
};

function adjustCss(a: Adjust): string | null {
  const brightness = a.brightness * (1 + a.exposure / 200);
  const contrast = a.contrast * (1 + a.highlights / 300);
  const parts = [
    `brightness(${brightness.toFixed(1)}%)`,
    `contrast(${contrast.toFixed(1)}%)`,
    `saturate(${a.saturate}%)`,
    `hue-rotate(${a.hue}deg)`,
    `grayscale(${a.gray}%)`,
  ];
  const clean =
    a.brightness === 100 &&
    a.contrast === 100 &&
    a.exposure === 0 &&
    a.highlights === 0 &&
    a.saturate === 100 &&
    a.hue === 0 &&
    a.gray === 0;
  return clean ? null : parts.join(" ");
}

function Page() {
  const [tool, setTool] = useState<Tool>("crc");
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<ImageBitmap[]>([]);
  const [idx, setIdx] = useState(-1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<Adjust>(DEFAULT_ADJUST);
  const urlRef = useRef<string | null>(null);

  const bitmap = idx >= 0 ? history[idx] : null;
  const filterCss = adjustCss(adjust);
  const adjustDirty = filterCss !== null || adjust.sharpness > 0;

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
    },
    [idx],
  );

  const pushCanvas = useCallback(
    async (canvas: HTMLCanvasElement) => {
      push(await createImageBitmap(canvas));
    },
    [push],
  );

  /** Bake the live adjustment sliders into the pixels before a pixel op. */
  const flatten = useCallback(async (): Promise<ImageBitmap | null> => {
    if (!bitmap) return null;
    if (!adjustDirty) return bitmap;
    let out = bitmap;
    if (filterCss) out = await createImageBitmap(await applyCssFilter(out, filterCss));
    if (adjust.sharpness > 0) {
      out = await createImageBitmap(await unsharpMask(out, (adjust.sharpness / 100) * 2));
    }
    push(out);
    setAdjust(DEFAULT_ADJUST);
    return out;
  }, [bitmap, adjustDirty, filterCss, adjust.sharpness, push]);

  const load = async (f: File) => {
    try {
      setError(null);
      const bmp = await loadBitmap(f);
      setFile(f);
      setHistory([bmp]);
      setIdx(0);
      setAdjust(DEFAULT_ADJUST);
    } catch {
      setError("Could not read this image.");
    }
  };

  const reset = () => {
    setFile(null);
    setHistory([]);
    setIdx(-1);
    setPreviewUrl(null);
    setAdjust(DEFAULT_ADJUST);
  };

  const [boxes, setBoxes] = useState<TextBox[]>([]);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);

  const applyText = async () => {
    if (boxes.length > 0) toast.success("Text applied — you can keep editing it");
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
            <span className="text-[11px] text-muted-foreground">Tap-to-focus live preview</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          {/* Left: the single working image */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={idx <= 0}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
              <button
                type="button"
                disabled={idx >= history.length - 1}
                onClick={() => setIdx((i) => Math.min(history.length - 1, i + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
              >
                <Redo2 className="h-3.5 w-3.5" /> Redo
              </button>
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => {
                  setIdx(0);
                  setAdjust(DEFAULT_ADJUST);
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
                {tool === "crc" ? (
                  <CropPreview
                    url={previewUrl}
                    naturalWidth={bitmap.width}
                    naturalHeight={bitmap.height}
                    onApplyCrop={async (r) => {
                      const base = (await flatten()) ?? bitmap;
                      pushCanvas(bitmapToCanvas(await cropBitmap(base, r)));
                    }}
                    onReset={() => setIdx(0)}
                    onRotateLeft={async () => {
                      const base = (await flatten()) ?? bitmap;
                      pushCanvas(bitmapToCanvas(await rotateBitmap(base, -90)));
                    }}
                    onRotateRight={async () => {
                      const base = (await flatten()) ?? bitmap;
                      pushCanvas(bitmapToCanvas(await rotateBitmap(base, 90)));
                    }}
                    onRotateFine={async (d) => {
                      const base = (await flatten()) ?? bitmap;
                      pushCanvas(bitmapToCanvas(await rotateBitmapCropped(base, d)));
                    }}
                  />
                ) : tool === "text" ? (
                  <TextLayer
                    url={previewUrl}
                    boxes={boxes}
                    onChange={setBoxes}
                    selectedId={selectedBox}
                    onSelect={setSelectedBox}
                    filterCss={filterCss}
                  />
                ) : tool === "blur" ? (
                  <BlurPreviewSlot
                    url={previewUrl}
                    bitmap={bitmap}
                    filterCss={filterCss}
                    onResult={pushCanvas}
                    flatten={flatten}
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
                  const base = await flatten();
                  if (!base) return;
                  const blob = await canvasToBlob(bitmapToCanvas(base), "image/png");
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
                  onClick={() => setTool(t.key)}
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
                {tool === "crc" && (
                  <CropRotateCompressPanel
                    bitmap={bitmap}
                    flatten={flatten}
                    onResult={pushCanvas}
                  />
                )}
                {tool === "text" && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Add text</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Click the image to drop a text box and start typing. Use the badge at its
                      corner to move it, the dot below to resize.
                    </p>
                    <TextLayerList
                      boxes={boxes}
                      selectedId={selectedBox}
                      onSelect={setSelectedBox}
                      onChange={setBoxes}
                    />
                    {current ? (
                      <TextBoxControls
                        box={current}
                        onChange={(nb) => setBoxes(boxes.map((b) => (b.id === nb.id ? nb : b)))}
                        onDuplicate={() => {
                          const copy = {
                            ...current,
                            id: Math.random().toString(36).slice(2),
                            x: Math.min(0.95, current.x + 0.03),
                            y: Math.min(0.95, current.y + 0.03),
                          };
                          setBoxes([...boxes, copy]);
                          setSelectedBox(copy.id);
                        }}
                        onDelete={() => {
                          setBoxes(boxes.filter((b) => b.id !== current.id));
                          setSelectedBox(null);
                        }}
                      />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Select a text box to edit its style.
                      </p>
                    )}
                    <Btn onClick={applyText} disabled={boxes.length === 0}>
                      Apply text to image
                    </Btn>
                  </div>
                )}
                {tool === "bright" && <BrightPanel adjust={adjust} setAdjust={setAdjust} />}
                {tool === "color" && <ColorPanel adjust={adjust} setAdjust={setAdjust} />}
                {tool === "blur" && (
                  <div className="space-y-2 text-[11px] text-muted-foreground">
                    <h3 className="text-sm font-semibold text-foreground">Blur area</h3>
                    Paint over the part of the image you want blurred, then apply. Brush size and
                    strength are on the image panel.
                  </div>
                )}
                {tool === "convert" && (
                  <ConvertPanel bitmap={bitmap} flatten={flatten} originalName={file.name} />
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

type Flatten = () => Promise<ImageBitmap | null>;

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

const DPI_PRESETS = [72, 150, 300, 600];

function DpiPicker({
  dpi,
  setDpi,
}: {
  dpi: number;
  setDpi: (n: number) => void;
}) {
  const [custom, setCustom] = useState("");
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-muted-foreground">DPI</div>
      <Row>
        {DPI_PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDpi(d);
              setCustom("");
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium",
              dpi === d && !custom
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent",
            )}
          >
            {d}
          </button>
        ))}
        <input
          type="number"
          value={custom}
          placeholder="custom"
          onChange={(e) => {
            setCustom(e.target.value);
            const v = parseInt(e.target.value, 10);
            if (v > 0) setDpi(v);
          }}
          className="w-20 rounded border border-input bg-background px-2 py-1 text-[11px]"
        />
      </Row>
    </div>
  );
}

const KB_PRESETS = [20, 30, 50, 100];

function CropRotateCompressPanel({
  bitmap,
  flatten,
  onResult,
}: {
  bitmap: ImageBitmap;
  flatten: Flatten;
  onResult: (c: HTMLCanvasElement) => Promise<void> | void;
}) {
  const [w, setW] = useState(bitmap.width);
  const [h, setH] = useState(bitmap.height);
  const [lock, setLock] = useState(true);
  const ratio = bitmap.width / bitmap.height;

  const [targetKB, setTargetKB] = useState(50);
  const [custom, setCustom] = useState("");
  const [dpi, setDpi] = useState(300);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setW(bitmap.width);
    setH(bitmap.height);
  }, [bitmap]);

  const target = useMemo(() => {
    const c = parseFloat(custom);
    return custom && !Number.isNaN(c) && c > 0 ? c : targetKB;
  }, [custom, targetKB]);

  const compress = async () => {
    setBusy(true);
    setInfo(null);
    try {
      const base = (await flatten()) ?? bitmap;
      const r = await compressBelow(base, target * 1024);
      const out = await setJpegDpi(r.blob, dpi);
      setInfo(
        `${(out.size / 1024).toFixed(1)} KB · ${r.width}×${r.height} · ${dpi} DPI${
          r.downscaled ? " (downscaled to fit)" : " · original size kept"
        }`,
      );
      downloadBlob(out, `compressed-${Math.round(target)}kb.jpg`);
      toast.success(`Compressed to ${(out.size / 1024).toFixed(1)} KB`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Crop, Rotate &amp; Compress</h3>
      <p className="text-[11px] text-muted-foreground">
        Drag the handles on the image, use the rotation slider, then press Apply.
      </p>
      <Row>
        <Btn
          onClick={async () => onResult(await flipCanvas((await flatten()) ?? bitmap, "h"))}
        >
          Flip H
        </Btn>
        <Btn
          onClick={async () => onResult(await flipCanvas((await flatten()) ?? bitmap, "v"))}
        >
          Flip V
        </Btn>
      </Row>

      <div className="space-y-2 border-t border-border pt-2">
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
        <Btn onClick={async () => onResult(await resizeCanvas((await flatten()) ?? bitmap, w, h))}>
          Apply resize
        </Btn>
      </div>

      <div className="space-y-2 border-t border-border pt-2">
        <div className="text-[11px] font-semibold text-muted-foreground">Compress</div>
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
          <input
            type="number"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="custom KB"
            className="w-24 rounded border border-input bg-background px-2 py-1 text-[11px]"
          />
        </Row>
        <DpiPicker dpi={dpi} setDpi={setDpi} />
        <Btn onClick={compress} busy={busy}>
          Compress below {Math.round(target)} KB
        </Btn>
        {info && <div className="text-[11px] text-muted-foreground">{info}</div>}
      </div>
    </div>
  );
}

function BrightPanel({
  adjust,
  setAdjust,
}: {
  adjust: Adjust;
  setAdjust: (fn: (a: Adjust) => Adjust) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Brightness / Contrast</h3>
      <p className="text-[11px] text-muted-foreground">
        Live preview — values stay put when you switch tools and are baked in on export.
      </p>
      <Slider
        label="Brightness"
        value={adjust.brightness}
        min={20}
        max={200}
        onChange={(v) => setAdjust((a) => ({ ...a, brightness: v }))}
        suffix="%"
      />
      <Slider
        label="Contrast"
        value={adjust.contrast}
        min={20}
        max={200}
        onChange={(v) => setAdjust((a) => ({ ...a, contrast: v }))}
        suffix="%"
      />
      <Slider
        label="Exposure"
        value={adjust.exposure}
        min={-100}
        max={100}
        onChange={(v) => setAdjust((a) => ({ ...a, exposure: v }))}
      />
      <Slider
        label="Highlights"
        value={adjust.highlights}
        min={-100}
        max={100}
        onChange={(v) => setAdjust((a) => ({ ...a, highlights: v }))}
      />
      <Slider
        label="Sharpness"
        value={adjust.sharpness}
        min={0}
        max={100}
        onChange={(v) => setAdjust((a) => ({ ...a, sharpness: v }))}
        suffix="%"
      />
      <Row>
        <Btn
          onClick={() =>
            setAdjust((a) => ({
              ...a,
              brightness: 100,
              contrast: 100,
              exposure: 0,
              highlights: 0,
              sharpness: 0,
            }))
          }
        >
          Reset
        </Btn>
        <Btn
          onClick={() =>
            setAdjust((a) => ({
              ...a,
              brightness: 108,
              contrast: 118,
              exposure: 6,
              highlights: 10,
              sharpness: 45,
            }))
          }
        >
          Auto enhance
        </Btn>
        <Btn
          onClick={() =>
            setAdjust((a) => ({
              ...a,
              brightness: 112,
              contrast: 125,
              exposure: 8,
              highlights: -4,
              sharpness: 62,
            }))
          }
        >
          Photograph
        </Btn>
        <Btn
          onClick={() =>
            setAdjust((a) => ({
              ...a,
              brightness: 106,
              contrast: 138,
              exposure: 2,
              highlights: -18,
              sharpness: 78,
              saturate: 82,
            }))
          }
        >
          Study document
        </Btn>
      </Row>
    </div>
  );
}

function ColorPanel({
  adjust,
  setAdjust,
}: {
  adjust: Adjust;
  setAdjust: (fn: (a: Adjust) => Adjust) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Colour</h3>
      <p className="text-[11px] text-muted-foreground">
        Sliders act live — no apply needed.
      </p>
      <Slider
        label="Saturation"
        value={adjust.saturate}
        min={0}
        max={300}
        onChange={(v) => setAdjust((a) => ({ ...a, saturate: v }))}
        suffix="%"
      />
      <Slider
        label="Hue"
        value={adjust.hue}
        min={0}
        max={360}
        onChange={(v) => setAdjust((a) => ({ ...a, hue: v }))}
        suffix="°"
      />
      <Slider
        label="Grayscale"
        value={adjust.gray}
        min={0}
        max={100}
        onChange={(v) => setAdjust((a) => ({ ...a, gray: v }))}
        suffix="%"
      />
      <Btn
        onClick={() => setAdjust((a) => ({ ...a, saturate: 100, hue: 0, gray: 0 }))}
      >
        Reset colour
      </Btn>
    </div>
  );
}

function BlurPreviewSlot({
  url,
  bitmap,
  filterCss,
  onResult,
  flatten,
}: {
  url: string;
  bitmap: ImageBitmap;
  filterCss: string | null;
  onResult: (c: HTMLCanvasElement) => Promise<void> | void;
  flatten: Flatten;
}) {
  const [brush, setBrush] = useState(18);
  const [strength, setStrength] = useState(6);
  const [busy, setBusy] = useState(false);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const onMask = useCallback((m: HTMLCanvasElement | null) => {
    maskRef.current = m;
  }, []);

  return (
    <div className="space-y-2">
      <BlurBrush
        url={url}
        width={bitmap.width}
        height={bitmap.height}
        brush={brush}
        filterCss={filterCss}
        onMask={onMask}
      />
      <div className="grid gap-2 rounded-md border border-border bg-muted/40 p-2 sm:grid-cols-2">
        <Slider label="Brush size" value={brush} min={4} max={60} onChange={setBrush} />
        <Slider
          label="Strength"
          value={strength}
          min={1}
          max={14}
          onChange={setStrength}
          suffix="px"
        />
        <div className="sm:col-span-2">
          <Btn
            busy={busy}
            onClick={async () => {
              if (!maskRef.current) {
                toast.error("Paint over an area first");
                return;
              }
              setBusy(true);
              try {
                const base = (await flatten()) ?? bitmap;
                await onResult(await regionBlurCanvas(base, maskRef.current, strength));
                toast.success("Area blurred");
              } finally {
                setBusy(false);
              }
            }}
          >
            Apply blur to painted area
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ConvertPanel({
  bitmap,
  flatten,
  originalName,
}: {
  bitmap: ImageBitmap;
  flatten: Flatten;
  originalName: string;
}) {
  const [t, setT] = useState<"jpeg" | "png" | "webp" | "pdf">("jpeg");
  const [busy, setBusy] = useState(false);
  const base = originalName.replace(/\.[^.]+$/, "");

  const run = async () => {
    setBusy(true);
    try {
      const bmp = (await flatten()) ?? bitmap;
      const canvas = bitmapToCanvas(bmp);
      if (t === "pdf") {
        const { PDFDocument } = await import("pdf-lib");
        const jpg = await canvasToBlob(canvas, "image/jpeg", 0.95);
        const doc = await PDFDocument.create();
        const img = await doc.embedJpg(await jpg.arrayBuffer());
        const page = doc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        const bytes = await doc.save();
        downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${base}.pdf`);
      } else {
        const blob = await canvasToBlob(canvas, `image/${t}`, 0.95);
        downloadBlob(blob, `${base}.${t === "jpeg" ? "jpg" : t}`);
      }
      toast.success(`Converted to ${t.toUpperCase()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Convert format</h3>
      <Row>
        {(["jpeg", "png", "webp", "pdf"] as const).map((k) => (
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
      <Btn onClick={run} busy={busy}>
        Convert &amp; download
      </Btn>
    </div>
  );
}
