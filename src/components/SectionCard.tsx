import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, Loader2, Upload } from "lucide-react";
import {
  compressToRange,
  cropBitmap,
  encodePng,
  loadBitmap,
  rotateBitmap,
  setJpegDpi,
  type CompressResult,
  type CropRect,
} from "@/lib/compress-image";
import { CropPreview } from "./CropPreview";
import { CameraCapture } from "./CameraCapture";

type Format = "jpg" | "jpeg" | "png";

interface Props {
  title: string;
  description: string;
  minKB: number;
  maxKB: number;
  downloadBase: string;
  accent: string;
  dpi?: boolean;
}

const DPI_PRESETS = [72, 150, 300, 600];

export function SectionCard({
  title,
  description,
  minKB,
  maxKB,
  downloadBase,
  accent,
  dpi: dpiEnabled,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [originalBitmap, setOriginalBitmap] = useState<ImageBitmap | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [jpegUrl, setJpegUrl] = useState<string | null>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("jpg");
  const [dpi, setDpi] = useState<number>(300);
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (jpegUrl) URL.revokeObjectURL(jpegUrl);
      if (pngUrl) URL.revokeObjectURL(pngUrl);
    };
  }, [previewUrl, jpegUrl, pngUrl]);

  const clearOutputs = () => {
    setResult(null);
    if (jpegUrl) URL.revokeObjectURL(jpegUrl);
    setJpegUrl(null);
    if (pngUrl) URL.revokeObjectURL(pngUrl);
    setPngUrl(null);
  };

  const updatePreview = (bmp: ImageBitmap) => {
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    canvas.toBlob(
      (b) => {
        if (!b) return;
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(b);
        });
      },
      "image/jpeg",
      0.85,
    );
  };

  const runCompress = async (bmp: ImageBitmap) => {
    setBusy(true);
    setError(null);
    clearOutputs();
    try {
      const r = await compressToRange(bmp, minKB * 1024, maxKB * 1024);
      setResult(r);
      const tagged = dpiEnabled ? await setJpegDpi(r.blob, dpi) : r.blob;
      setJpegUrl(URL.createObjectURL(tagged));
      const inRange = r.blob.size > minKB * 1024 && r.blob.size < maxKB * 1024;
      if (!inRange) {
        setError(
          `Could not land strictly in ${minKB}\u2013${maxKB} KB. Closest result: ${r.sizeKB.toFixed(1)} KB.`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (f: File) => {
    setError(null);
    clearOutputs();
    try {
      const bmp = await loadBitmap(f);
      setFile(f);
      setOriginalBitmap(bmp);
      setBitmap(bmp);
      updatePreview(bmp);
      await runCompress(bmp);
    } catch (e) {
      setError("Could not read this image. Try JPG, PNG, or WEBP.");
      console.error(e);
    }
  };

  const rotate = async (deg: number) => {
    if (!bitmap) return;
    setBusy(true);
    const rotated = await rotateBitmap(bitmap, deg);
    setBitmap(rotated);
    setOriginalBitmap(rotated);
    updatePreview(rotated);
    await runCompress(rotated);
  };

  const rotateFine = async (deg: number) => {
    if (!bitmap || deg === 0) return;
    setBusy(true);
    const rotated = await rotateBitmap(bitmap, deg);
    setBitmap(rotated);
    setOriginalBitmap(rotated);
    updatePreview(rotated);
    await runCompress(rotated);
  };

  const applyCrop = async (rect: CropRect) => {
    if (!bitmap) return;
    setBusy(true);
    const cropped = await cropBitmap(bitmap, rect);
    setBitmap(cropped);
    updatePreview(cropped);
    await runCompress(cropped);
  };

  const resetCrop = async () => {
    if (!originalBitmap) return;
    setBusy(true);
    setBitmap(originalBitmap);
    updatePreview(originalBitmap);
    await runCompress(originalBitmap);
  };

  const clear = () => {
    setFile(null);
    setBitmap(null);
    setOriginalBitmap(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    clearOutputs();
    if (inputRef.current) inputRef.current.value = "";
  };

  // Re-tag JPEG blob when DPI changes.
  useEffect(() => {
    if (!dpiEnabled || !result) return;
    let cancelled = false;
    (async () => {
      const tagged = await setJpegDpi(result.blob, dpi);
      if (cancelled) return;
      setJpegUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(tagged);
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dpi, dpiEnabled]);

  // Lazily encode PNG when the user selects PNG.
  useEffect(() => {
    if (format !== "png" || !bitmap || pngUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const blob = await encodePng(bitmap);
        if (cancelled) return;
        setPngUrl(URL.createObjectURL(blob));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [format, bitmap, pngUrl]);

  const originalKB = file ? file.size / 1024 : 0;
  const inRange = result ? result.blob.size > minKB * 1024 && result.blob.size < maxKB * 1024 : false;

  const downloadHref = format === "png" ? pngUrl : jpegUrl;
  const downloadFilename = `${downloadBase}.${format}`;
  const pngSizeKB = useMemo(() => {
    // We don't need to display it, but keep for future.
    return null as number | null;
  }, []);
  void pngSizeKB;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${accent}`} />
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Target: strictly &gt; {minKB} KB and &lt; {maxKB} KB
          </p>
        </div>
      </div>

      {!file ? (
        <div className="mt-4 space-y-2">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center hover:bg-muted"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="mt-2 text-sm font-medium">Click or drop image here</div>
            <div className="text-xs text-muted-foreground">JPG, JPEG, PNG, WEBP</div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Camera className="h-4 w-4" /> Use camera
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {previewUrl && bitmap && (
            <CropPreview
              url={previewUrl}
              naturalWidth={bitmap.width}
              naturalHeight={bitmap.height}
              onApplyCrop={applyCrop}
              onReset={resetCrop}
              onRotateLeft={() => rotate(-90)}
              onRotateRight={() => rotate(90)}
              onRotateFine={rotateFine}
              onClear={clear}
              disabled={busy}
            />
          )}

          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Camera className="h-3.5 w-3.5" /> Retake with camera
          </button>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-muted px-3 py-2">
              <div className="text-xs text-muted-foreground">Original</div>
              <div className="font-medium">{originalKB.toFixed(1)} KB</div>
            </div>
            <div
              className={`rounded-md px-3 py-2 ${
                inRange ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted"
              }`}
            >
              <div className="text-xs opacity-80">Compressed</div>
              <div className="font-medium">
                {busy ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> working…
                  </span>
                ) : result ? (
                  `${result.sizeKB.toFixed(1)} KB`
                ) : (
                  "—"
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {dpiEnabled && (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">DPI (print resolution)</span>
                <span className="tabular-nums text-foreground">{dpi} dpi</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={72}
                  max={1200}
                  value={dpi}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) setDpi(Math.max(72, Math.min(1200, v)));
                  }}
                  className="w-20 rounded border border-input bg-background px-2 py-1 text-xs"
                />
                {DPI_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDpi(p)}
                    className={`rounded px-2 py-1 text-[11px] font-medium border ${
                      dpi === p
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Metadata only — pixels and file size don't change. Applies to JPG/JPEG.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Format:</span>
              {(["jpg", "png", "jpeg"] as Format[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    format === f
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            {format === "png" && (
              <p className="text-[11px] text-muted-foreground">
                PNG is lossless — file may exceed the KB target.
              </p>
            )}
          </div>

          {downloadHref && !busy && (
            <a
              href={downloadHref}
              download={downloadFilename}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Download {downloadFilename}
            </a>
          )}
        </div>
      )}

      {cameraOpen && (
        <CameraCapture
          onCapture={(f) => {
            setCameraOpen(false);
            handleFile(f);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
