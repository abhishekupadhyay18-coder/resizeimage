import { useEffect, useRef, useState } from "react";
import { Download, Upload, Loader2 } from "lucide-react";
import {
  autoCropBitmap,
  compressToRange,
  loadBitmap,
  rotateBitmap,
  type CompressResult,
} from "@/lib/compress-image";
import { RotatablePreview } from "./RotatablePreview";

interface Props {
  title: string;
  description: string;
  minKB: number;
  maxKB: number;
  downloadName: string;
  accent: string; // tailwind bg color class for header dot
  cropSensitivity: number;
}

export function SectionCard({
  title,
  description,
  minKB,
  maxKB,
  downloadName,
  accent,
  cropSensitivity,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [previewUrl, resultUrl]);

  const updatePreview = (bmp: ImageBitmap) => {
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    canvas.toBlob((b) => {
      if (!b) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(b));
    }, "image/jpeg", 0.85);
  };

  const runCompress = async (bmp: ImageBitmap) => {
    setBusy(true);
    setError(null);
    setResult(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    try {
      const r = await compressToRange(bmp, minKB * 1024, maxKB * 1024);
      setResult(r);
      setResultUrl(URL.createObjectURL(r.blob));
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
    setResult(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    try {
      const raw = await loadBitmap(f);
      const bmp = await autoCropBitmap(raw, cropSensitivity);
      setFile(f);
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
    updatePreview(rotated);
    await runCompress(rotated);
  };

  const autoCrop = async () => {
    if (!bitmap) return;
    setBusy(true);
    const cropped = await autoCropBitmap(bitmap, cropSensitivity);
    setBitmap(cropped);
    updatePreview(cropped);
    await runCompress(cropped);
  };

  const clear = () => {
    setFile(null);
    setBitmap(null);
    setResult(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setPreviewUrl(null);
    setResultUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const originalKB = file ? file.size / 1024 : 0;
  const inRange = result ? result.blob.size > minKB * 1024 && result.blob.size < maxKB * 1024 : false;

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
        <label
          className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center hover:bg-muted"
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
      ) : (
        <div className="mt-4 space-y-4">
          {previewUrl && (
            <RotatablePreview
              url={previewUrl}
              onRotateLeft={() => rotate(-90)}
              onRotateRight={() => rotate(90)}
              onAutoCrop={autoCrop}
              onClear={clear}
              disabled={busy}
            />
          )}

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

          {resultUrl && !busy && (
            <a
              href={resultUrl}
              download={downloadName}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Download {downloadName}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
