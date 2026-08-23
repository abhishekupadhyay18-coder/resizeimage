import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
}

type FocusRing = { id: number; x: number; y: number };

/** Extra constraint fields not present in the standard TS lib types. */
type FocusCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  pointsOfInterest?: unknown;
};

export function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastFocusAt = useRef(0);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [ring, setRing] = useState<FocusRing | null>(null);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not available in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 4096 },
            height: { ideal: 4096 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stop();
        streamRef.current = stream;
        // Prefer continuous autofocus when the hardware exposes it.
        const track = stream.getVideoTracks()[0];
        try {
          const caps = track?.getCapabilities?.() as FocusCapabilities | undefined;
          if (caps?.focusMode?.includes("continuous")) {
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
            });
          }
        } catch {
          /* focus control unsupported — fine */
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setReady(true);
        }
      } catch (e) {
        console.error(e);
        setError(
          "Could not access the camera. Grant permission and use HTTPS, then try again.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facingMode, stop]);

  /** Tap-to-focus: show a ring and ask the hardware to focus on that point. */
  const focusAt = async (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setRing({ id: Date.now(), x, y });
    lastFocusAt.current = Date.now();
    window.setTimeout(() => setRing((cur) => (cur && Date.now() - cur.id > 500 ? null : cur)), 900);

    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const caps = track.getCapabilities?.() as FocusCapabilities | undefined;
      const advanced: MediaTrackConstraintSet[] = [];
      if (caps && "pointsOfInterest" in caps) {
        advanced.push({
          pointsOfInterest: [{ x: (x / r.width) || 0.5, y: (y / r.height) || 0.5 }],
        } as unknown as MediaTrackConstraintSet);
      }
      if (caps?.focusMode?.includes("single-shot")) {
        advanced.push({ focusMode: "single-shot" } as MediaTrackConstraintSet);
      } else if (caps?.focusMode?.includes("manual")) {
        advanced.push({ focusMode: "manual" } as MediaTrackConstraintSet);
      }
      if (advanced.length) await track.applyConstraints({ advanced });
    } catch {
      /* visual-only fallback */
    }
  };

  useEffect(() => {
    if (!ring) return;
    const t = window.setTimeout(() => setRing(null), 900);
    return () => window.clearTimeout(t);
  }, [ring]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !ready || busy) return;
    setBusy(true);
    try {
      // Let the frame settle after a recent focus tap.
      const since = Date.now() - lastFocusAt.current;
      if (since < 700) {
        await new Promise((r) => setTimeout(r, 700 - since));
      }
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.96),
      );
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      stop();
      onCapture(file);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    stop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="text-sm font-medium">Camera</div>
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close camera"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          className="relative aspect-[3/4] w-full cursor-crosshair bg-black touch-none sm:aspect-video"
          onPointerDown={focusAt}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="pointer-events-none h-full w-full object-contain"
          />
          {ring && (
            <span
              key={ring.id}
              className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary shadow-[0_0_0_1px_rgba(0,0,0,.4)] animate-in fade-in zoom-in-50 duration-200"
              style={{ left: ring.x, top: ring.y }}
            >
              <span className="absolute inset-2 rounded-full border border-primary/60" />
            </span>
          )}
          {!error && (
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[11px] text-white">
              Tap anywhere to focus
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={() =>
              setFacingMode((f) => (f === "environment" ? "user" : "environment"))
            }
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Switch
          </button>
          <button
            type="button"
            onClick={capture}
            disabled={!ready || !!error || busy}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" /> {busy ? "Focusing…" : "Capture"}
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
