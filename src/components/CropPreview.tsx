import { useCallback, useEffect, useRef, useState } from "react";
import { Check, RotateCcw, RotateCw, Undo2, X } from "lucide-react";
import type { CropRect } from "@/lib/compress-image";

interface Props {
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  label?: string;
  onApplyCrop: (rect: CropRect) => void;
  onReset: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onRotateFine: (degrees: number) => void;
  onClear?: () => void;
  disabled?: boolean;
}

type DragMode =
  | { kind: "move"; startX: number; startY: number; rect: CropRect }
  | {
      kind: "resize";
      handle: string;
      startX: number;
      startY: number;
      rect: CropRect;
    }
  | null;

const MIN_SIZE = 20;

const HANDLES: Array<{ key: string; cx: number; cy: number; cursor: string }> = [
  { key: "nw", cx: 0, cy: 0, cursor: "nwse-resize" },
  { key: "n", cx: 0.5, cy: 0, cursor: "ns-resize" },
  { key: "ne", cx: 1, cy: 0, cursor: "nesw-resize" },
  { key: "e", cx: 1, cy: 0.5, cursor: "ew-resize" },
  { key: "se", cx: 1, cy: 1, cursor: "nwse-resize" },
  { key: "s", cx: 0.5, cy: 1, cursor: "ns-resize" },
  { key: "sw", cx: 0, cy: 1, cursor: "nesw-resize" },
  { key: "w", cx: 0, cy: 0.5, cursor: "ew-resize" },
];

// Start with the full image so the four corner handles sit exactly on the
// image corners — clearly visible and inviting a drag inward.
function initialRect(w: number, h: number): CropRect {
  return { x: 0, y: 0, w, h };
}


export function CropPreview({
  url,
  naturalWidth,
  naturalHeight,
  label,
  onApplyCrop,
  onReset,
  onRotateLeft,
  onRotateRight,
  onRotateFine,
  onClear,
  disabled,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<CropRect>(() =>
    initialRect(naturalWidth, naturalHeight),
  );
  const [fineDeg, setFineDeg] = useState(0);
  const dragRef = useRef<DragMode>(null);

  useEffect(() => {
    setRect(initialRect(naturalWidth, naturalHeight));
    setFineDeg(0);
  }, [url, naturalWidth, naturalHeight]);

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    setDisplaySize({ w: img.clientWidth, h: img.clientHeight });
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (imgRef.current) ro.observe(imgRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const scaleX = displaySize.w / naturalWidth || 1;
  const scaleY = displaySize.h / naturalHeight || 1;

  const clamp = (r: CropRect): CropRect => {
    const x = Math.max(0, Math.min(naturalWidth - MIN_SIZE, r.x));
    const y = Math.max(0, Math.min(naturalHeight - MIN_SIZE, r.y));
    const w = Math.max(MIN_SIZE, Math.min(naturalWidth - x, r.w));
    const h = Math.max(MIN_SIZE, Math.min(naturalHeight - y, r.h));
    return { x, y, w, h };
  };

  const onPointerDown = (
    e: React.PointerEvent,
    mode: "move" | { handle: string },
  ) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    if (mode === "move") {
      dragRef.current = {
        kind: "move",
        startX: e.clientX,
        startY: e.clientY,
        rect,
      };
    } else {
      dragRef.current = {
        kind: "resize",
        handle: mode.handle,
        startX: e.clientX,
        startY: e.clientY,
        rect,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scaleX;
    const dy = (e.clientY - d.startY) / scaleY;
    if (d.kind === "move") {
      setRect(clamp({ x: d.rect.x + dx, y: d.rect.y + dy, w: d.rect.w, h: d.rect.h }));
      return;
    }
    let { x, y, w, h } = d.rect;
    const h_ = d.handle;
    if (h_.includes("w")) {
      x = d.rect.x + dx;
      w = d.rect.w - dx;
    }
    if (h_.includes("e")) {
      w = d.rect.w + dx;
    }
    if (h_.includes("n")) {
      y = d.rect.y + dy;
      h = d.rect.h - dy;
    }
    if (h_.includes("s")) {
      h = d.rect.h + dy;
    }
    if (w < MIN_SIZE) {
      if (h_.includes("w")) x = d.rect.x + d.rect.w - MIN_SIZE;
      w = MIN_SIZE;
    }
    if (h < MIN_SIZE) {
      if (h_.includes("n")) y = d.rect.y + d.rect.h - MIN_SIZE;
      h = MIN_SIZE;
    }
    setRect(clamp({ x, y, w, h }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const cropChanged =
    rect.x > 0 ||
    rect.y > 0 ||
    rect.w < naturalWidth ||
    rect.h < naturalHeight;

  const displayRect = {
    left: rect.x * scaleX,
    top: rect.y * scaleY,
    width: rect.w * scaleX,
    height: rect.h * scaleY,
  };

  const applyAll = async () => {
    // Commit rotation first (parent replaces bitmap), then crop.
    // We call sequentially; parent handlers are async-safe.
    if (fineDeg !== 0) {
      await Promise.resolve(onRotateFine(fineDeg));
      setFineDeg(0);
      // After rotation the natural size changes; reset crop rect.
      // Parent will re-render with new url/naturalWidth/naturalHeight,
      // which triggers our effect to reset the rect. Skip cropping here
      // if the user didn't touch the crop rect.
      if (cropChanged) {
        // Best-effort: apply crop against current (pre-rotation) rect only
        // when rotation is 0. When both are set, we prefer rotation-only in
        // one apply — user can crop next.
      }
      return;
    }
    if (cropChanged) {
      await Promise.resolve(onApplyCrop(rect));
    }
  };

  const canApply = fineDeg !== 0 || cropChanged;

  return (
    <div className="space-y-2">
      {label && (
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      )}
      <div className="relative mx-auto max-h-96 w-fit overflow-hidden rounded-md border border-border bg-muted select-none touch-none">
        <div
          style={{
            clipPath:
              fineDeg === 0 || !displaySize.w
                ? undefined
                : `inset(${(displaySize.h - inscribed.h) / 2}px ${(displaySize.w - inscribed.w) / 2}px)`,
          }}
        >
          <img
            ref={imgRef}
            src={url}
            alt={label ?? "preview"}
            onLoad={measure}
            draggable={false}
            style={{ transform: `rotate(${fineDeg}deg)` }}
            className="block max-h-96 w-auto object-contain pointer-events-none transition-transform"
          />
        </div>

        {displaySize.w > 0 && (
          <>
            <div
              className="absolute inset-0 bg-black/50 pointer-events-none"
              style={{
                clipPath: `polygon(
                  0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                  ${displayRect.left}px ${displayRect.top}px,
                  ${displayRect.left}px ${displayRect.top + displayRect.height}px,
                  ${displayRect.left + displayRect.width}px ${displayRect.top + displayRect.height}px,
                  ${displayRect.left + displayRect.width}px ${displayRect.top}px,
                  ${displayRect.left}px ${displayRect.top}px
                )`,
              }}
            />
            <div
              className="absolute border-2 border-primary cursor-move shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
              style={{
                left: displayRect.left,
                top: displayRect.top,
                width: displayRect.width,
                height: displayRect.height,
                backgroundColor: "hsl(var(--primary) / 0.08)",
              }}
              onPointerDown={(e) => onPointerDown(e, "move")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/60" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/60" />
                <div className="absolute top-1/3 left-0 w-full h-px bg-white/60" />
                <div className="absolute top-2/3 left-0 w-full h-px bg-white/60" />
              </div>
              {HANDLES.map((h) => (
                <div
                  key={h.key}
                  onPointerDown={(e) => onPointerDown(e, { handle: h.key })}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-background bg-primary shadow-md ring-1 ring-primary/50"
                  style={{
                    left: `${h.cx * 100}%`,
                    top: `${h.cy * 100}%`,
                    cursor: h.cursor,
                    touchAction: "none",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Combined rotate + crop controls */}
      <div className="rounded-md border border-border bg-muted/40 p-2 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">Fine rotate</span>
          <span className="tabular-nums text-foreground">{fineDeg.toFixed(1)}°</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-45}
            max={45}
            step={0.1}
            value={fineDeg}
            disabled={disabled}
            onChange={(e) => setFineDeg(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
          <button
            type="button"
            onClick={() => setFineDeg(0)}
            disabled={disabled || fineDeg === 0}
            className="rounded border border-input bg-background px-2 py-0.5 text-[11px] hover:bg-accent disabled:opacity-50"
          >
            0°
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onRotateLeft}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 90° left
          </button>
          <button
            type="button"
            onClick={onRotateRight}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <RotateCw className="h-3.5 w-3.5" /> 90° right
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <Undo2 className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            type="button"
            onClick={applyAll}
            disabled={disabled || !canApply}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> Apply
          </button>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Adjust rotation and drag the corner handles to crop, then press Apply.
        </p>
      </div>
    </div>
  );
}

