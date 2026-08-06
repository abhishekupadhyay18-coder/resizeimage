import { useEffect, useRef, useState } from "react";
import { Camera, Download, Loader2, Upload } from "lucide-react";
import {
  compressToRange,
  cropBitmap,
  encodePng,
  loadBitmap,
  mergeVertical,
  rotateBitmap,
  type CompressResult,
  type CropRect,
} from "@/lib/compress-image";
import { CropPreview } from "./CropPreview";
import { CameraCapture } from "./CameraCapture";

const MIN_KB = 90;
const MAX_KB = 95;
const DOWNLOAD_BASE = "merged";

type Format = "jpg" | "jpeg" | "png";

interface SideState {
  file: File | null;
  original: ImageBitmap | null;
  bitmap: ImageBitmap | null;
  previewUrl: string | null;
}

const initialSide: SideState = { file: null, original: null, bitmap: null, previewUrl: null };

function bitmapToPreview(bmp: ImageBitmap): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    canvas.toBlob((b) => resolve(URL.createObjectURL(b!)), "image/jpeg", 0.85);
  });
}

export function AadhaarSection({
  onOutput,
}: {
  onOutput?: (out: { name: string; blob: Blob } | null) => void;
}) {
  const [front, setFront] = useState<SideState>(initialSide);
  const [back, setBack] = useState<SideState>(initialSide);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [mergedBitmap, setMergedBitmap] = useState<ImageBitmap | null>(null);
  const [jpegUrl, setJpegUrl] = useState<string | null>(null);
  const [jpegBlob, setJpegBlob] = useState<Blob | null>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [format, setFormat] = useState<Format>("jpg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraFor, setCameraFor] = useState<"front" | "back" | null>(null);
  const frontInput = useRef<HTMLInputElement>(null);
  const backInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (front.previewUrl) URL.revokeObjectURL(front.previewUrl);
      if (back.previewUrl) URL.revokeObjectURL(back.previewUrl);
      if (jpegUrl) URL.revokeObjectURL(jpegUrl);
      if (pngUrl) URL.revokeObjectURL(pngUrl);
    };
  }, [front.previewUrl, back.previewUrl, jpegUrl, pngUrl]);

  const invalidateResult = () => {
    if (jpegUrl) URL.revokeObjectURL(jpegUrl);
    if (pngUrl) URL.revokeObjectURL(pngUrl);
    setResult(null);
    setJpegUrl(null);
    setPngUrl(null);
    setMergedBitmap(null);
  };

  const setSide = async (which: "front" | "back", file: File) => {
    try {
      const bmp = await loadBitmap(file);
      const url = await bitmapToPreview(bmp);
      const state: SideState = { file, original: bmp, bitmap: bmp, previewUrl: url };
      if (which === "front") {
        if (front.previewUrl) URL.revokeObjectURL(front.previewUrl);
        setFront(state);
      } else {
        if (back.previewUrl) URL.revokeObjectURL(back.previewUrl);
        setBack(state);
      }
      invalidateResult();
      setError(null);
    } catch (e) {
      setError("Could not read image. Use JPG, PNG or WEBP.");
      console.error(e);
    }
  };

  const updateSide = async (which: "front" | "back", bmp: ImageBitmap, alsoOriginal = false) => {
    const s = which === "front" ? front : back;
    const url = await bitmapToPreview(bmp);
    if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    const next: SideState = {
      file: s.file,
      original: alsoOriginal ? bmp : s.original,
      bitmap: bmp,
      previewUrl: url,
    };
    if (which === "front") setFront(next);
    else setBack(next);
    invalidateResult();
  };

  const rotateSide = async (which: "front" | "back", deg: number) => {
    const s = which === "front" ? front : back;
    if (!s.bitmap) return;
    const rotated = await rotateBitmap(s.bitmap, deg);
    await updateSide(which, rotated, true);
  };

  const rotateFineSide = async (which: "front" | "back", deg: number) => {
    const s = which === "front" ? front : back;
    if (!s.bitmap || deg === 0) return;
    const rotated = await rotateBitmap(s.bitmap, deg);
    await updateSide(which, rotated, true);
  };

  const applyCropSide = async (which: "front" | "back", rect: CropRect) => {
    const s = which === "front" ? front : back;
    if (!s.bitmap) return;
    const cropped = await cropBitmap(s.bitmap, rect);
    await updateSide(which, cropped);
  };

  const resetSide = async (which: "front" | "back") => {
    const s = which === "front" ? front : back;
    if (!s.original) return;
    await updateSide(which, s.original);
  };

  const clearSide = (which: "front" | "back") => {
    const s = which === "front" ? front : back;
    if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    if (which === "front") {
      setFront(initialSide);
      if (frontInput.current) frontInput.current.value = "";
    } else {
      setBack(initialSide);
      if (backInput.current) backInput.current.value = "";
    }
    invalidateResult();
  };

  const mergeAndCompress = async () => {
    if (!front.bitmap || !back.bitmap) return;
    setBusy(true);
    setError(null);
    invalidateResult();
    try {
      const merged = await mergeVertical(front.bitmap, back.bitmap);
      setMergedBitmap(merged);
      const r = await compressToRange(merged, MIN_KB * 1024, MAX_KB * 1024);
      setResult(r);
      setJpegUrl(URL.createObjectURL(r.blob));
      const inRange = r.blob.size > MIN_KB * 1024 && r.blob.size < MAX_KB * 1024;
      if (!inRange) {
        setError(
          `Could not land strictly in ${MIN_KB}\u2013${MAX_KB} KB. Closest: ${r.sizeKB.toFixed(1)} KB.`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (format !== "png" || !mergedBitmap || pngUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const blob = await encodePng(mergedBitmap);
        if (cancelled) return;
        setPngUrl(URL.createObjectURL(blob));
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [format, mergedBitmap, pngUrl]);

  const renderSlot = (
    which: "front" | "back",
    state: SideState,
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    const label = which === "front" ? "Front" : "Back";
    if (!state.file || !state.bitmap || !state.previewUrl) {
      return (
        <div className="space-y-2">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-3 py-6 text-center hover:bg-muted"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setSide(which, f);
            }}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div className="mt-1 text-sm font-medium">{label} of Aadhaar</div>
            <div className="text-xs text-muted-foreground">Click or drop</div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setSide(which, f);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setCameraFor(which)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Camera className="h-3.5 w-3.5" /> Use camera
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <CropPreview
          url={state.previewUrl}
          naturalWidth={state.bitmap.width}
          naturalHeight={state.bitmap.height}
          label={label}
          onApplyCrop={(r) => applyCropSide(which, r)}
          onReset={() => resetSide(which)}
          onRotateLeft={() => rotateSide(which, -90)}
          onRotateRight={() => rotateSide(which, 90)}
          onRotateFine={(d) => rotateFineSide(which, d)}
          onClear={() => clearSide(which)}
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => setCameraFor(which)}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Camera className="h-3.5 w-3.5" /> Retake
        </button>
      </div>
    );
  };

  const inRange = result ? result.blob.size > MIN_KB * 1024 && result.blob.size < MAX_KB * 1024 : false;
  const downloadHref = format === "png" ? pngUrl : jpegUrl;
  const downloadFilename = `${DOWNLOAD_BASE}.${format}`;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
        <h2 className="text-lg font-semibold text-foreground">Merge and compress</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload front and back separately. They are merged vertically into one image, then compressed.
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Target: strictly &gt; {MIN_KB} KB and &lt; {MAX_KB} KB
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {renderSlot("front", front, frontInput)}
        {renderSlot("back", back, backInput)}
      </div>

      <div className="mt-4">
        <button
          type="button"
          disabled={!front.bitmap || !back.bitmap || busy}
          onClick={mergeAndCompress}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Merging & compressing…
            </>
          ) : (
            <>Merge & Compress</>
          )}
        </button>
      </div>

      {result && (
        <div className="mt-3">
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              inRange
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-muted"
            }`}
          >
            Final size: <span className="font-medium">{result.sizeKB.toFixed(1)} KB</span>{" "}
            <span className="opacity-70">
              ({result.width}×{result.height})
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-2">
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
      )}

      {downloadHref && !busy && (
        <a
          href={downloadHref}
          download={downloadFilename}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <Download className="h-4 w-4" /> Download {downloadFilename}
        </a>
      )}

      {cameraFor && (
        <CameraCapture
          onCapture={(f) => {
            const which = cameraFor;
            setCameraFor(null);
            setSide(which, f);
          }}
          onClose={() => setCameraFor(null)}
        />
      )}
    </div>
  );
}
