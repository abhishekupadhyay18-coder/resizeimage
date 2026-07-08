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

export function CropPreview({
  url,
  naturalWidth,
  naturalHeight,
  label,
  onApplyCrop,
  onReset,
  onRotateLeft,
  onRotateRight,
  onClear,
  disabled,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<CropRect>({
    x: 0,
    y: 0,
    w: naturalWidth,
    h: naturalHeight,
  });
  const dragRef = useRef<DragMode>(null);

  // Reset rect when image changes
  useEffect(() => {
    setRect({ x: 0, y: 0, w: naturalWidth, h: naturalHeight });
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
    // If width/height collapse below min, freeze position
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

  return (
    <div className="space-y-2">
      {label && (
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      )}
      <div className="relative mx-auto max-h-64 w-fit overflow-hidden rounded-md border border-border bg-muted select-none touch-none">
        <img
          ref={imgRef}
          src={url}
          alt={label ?? "preview"}
          onLoad={measure}
          draggable={false}
          className="block max-h-64 w-auto object-contain pointer-events-none"
        />
        {displaySize.w > 0 && (
          <>
            {/* Dim overlays */}
            <div
              className="absolute inset-0 bg-black/40 pointer-events-none"
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
            {/* Crop rect */}
            <div
              className="absolute border-2 border-primary cursor-move"
              style={{
                left: displayRect.left,
                top: displayRect.top,
                width: displayRect.width,
                height: displayRect.height,
              }}
              onPointerDown={(e) => onPointerDown(e, "move")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {HANDLES.map((h) => (
                <div
                  key={h.key}
                  onPointerDown={(e) => onPointerDown(e, { handle: h.key })}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-background bg-primary"
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
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onApplyCrop(rect)}
          disabled={disabled || !cropChanged}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Apply crop
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
          onClick={onRotateLeft}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Left
        </button>
        <button
          type="button"
          onClick={onRotateRight}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          <RotateCw className="h-3.5 w-3.5" /> Right
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}
