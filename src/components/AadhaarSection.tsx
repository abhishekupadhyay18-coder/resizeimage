import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import {
  autoCropBitmap,
  compressToRange,
  loadBitmap,
  mergeVertical,
  rotateBitmap,
  type CompressResult,
} from "@/lib/compress-image";
import { RotatablePreview } from "./RotatablePreview";

const MIN_KB = 90;
const MAX_KB = 95;

interface SideState {
  file: File | null;
  bitmap: ImageBitmap | null;
  previewUrl: string | null;
}

const initialSide: SideState = { file: null, bitmap: null, previewUrl: null };

function bitmapToPreview(bmp: ImageBitmap): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    canvas.toBlob((b) => resolve(URL.createObjectURL(b!)), "image/jpeg", 0.85);
  });
}

export function AadhaarSection() {
  const [front, setFront] = useState<SideState>(initialSide);
  const [back, setBack] = useState<SideState>(initialSide);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frontInput = useRef<HTMLInputElement>(null);
  const backInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (front.previewUrl) URL.revokeObjectURL(front.previewUrl);
      if (back.previewUrl) URL.revokeObjectURL(back.previewUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [front.previewUrl, back.previewUrl, resultUrl]);

  const setSide = async (
    which: "front" | "back",
    file: File,
  ) => {
    try {
      const raw = await loadBitmap(file);
      const bmp = await autoCropBitmap(raw);
      const url = await bitmapToPreview(bmp);
      const state = { file, bitmap: bmp, previewUrl: url };
      if (which === "front") {
        if (front.previewUrl) URL.revokeObjectURL(front.previewUrl);
        setFront(state);
      } else {
        if (back.previewUrl) URL.revokeObjectURL(back.previewUrl);
        setBack(state);
      }
      // reset previous merge result on new upload
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      setResult(null);
      setResultUrl(null);
      setError(null);
    } catch (e) {
      setError("Could not read image. Use JPG, PNG or WEBP.");
      console.error(e);
    }
  };

  const rotateSide = async (which: "front" | "back", deg: number) => {
    const s = which === "front" ? front : back;
    if (!s.bitmap) return;
    const rotated = await rotateBitmap(s.bitmap, deg);
    const url = await bitmapToPreview(rotated);
    if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    const next = { file: s.file, bitmap: rotated, previewUrl: url };
    if (which === "front") setFront(next);
    else setBack(next);
    // invalidate previous result
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResult(null);
    setResultUrl(null);
  };

  const autoCropSide = async (which: "front" | "back") => {
    const s = which === "front" ? front : back;
    if (!s.bitmap) return;
    const cropped = await autoCropBitmap(s.bitmap);
    const url = await bitmapToPreview(cropped);
    if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    const next = { file: s.file, bitmap: cropped, previewUrl: url };
    if (which === "front") setFront(next);
    else setBack(next);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResult(null);
    setResultUrl(null);
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
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResult(null);
    setResultUrl(null);
  };

  const mergeAndCompress = async () => {
    if (!front.bitmap || !back.bitmap) return;
    setBusy(true);
    setError(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setResult(null);
    try {
      const merged = await mergeVertical(front.bitmap, back.bitmap);
      const r = await compressToRange(merged, MIN_KB * 1024, MAX_KB * 1024);
      setResult(r);
      setResultUrl(URL.createObjectURL(r.blob));
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

  const renderSlot = (
    which: "front" | "back",
    state: SideState,
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    const label = which === "front" ? "Front" : "Back";
    if (!state.file) {
      return (
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
      );
    }
    return (
      <RotatablePreview
        url={state.previewUrl!}
        label={label}
        onRotateLeft={() => rotateSide(which, -90)}
        onRotateRight={() => rotateSide(which, 90)}
        onAutoCrop={() => autoCropSide(which)}
        onClear={() => clearSide(which)}
        disabled={busy}
      />
    );
  };

  const inRange = result ? result.blob.size > MIN_KB * 1024 && result.blob.size < MAX_KB * 1024 : false;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
        <h2 className="text-lg font-semibold text-foreground">Aadhaar Card</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload front and back separately. They are merged vertically into one JPG, then compressed.
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

      {resultUrl && !busy && (
        <a
          href={resultUrl}
          download="aadhaar.jpg"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <Download className="h-4 w-4" /> Download aadhaar.jpg
        </a>
      )}
    </div>
  );
}
