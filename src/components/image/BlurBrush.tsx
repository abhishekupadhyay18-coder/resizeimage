import { useEffect, useRef, useState } from "react";

interface Props {
  url: string;
  width: number;
  height: number;
  brush: number;
  filterCss?: string | null;
  /** Called with the painted mask (white = blur here) whenever it changes. */
  onMask: (mask: HTMLCanvasElement | null) => void;
}

/**
 * Paint-over-image mask editor: the user drags across the areas that should be
 * blurred. The mask is kept at full image resolution.
 */
export function BlurBrush({ url, width, height, brush, filterCss, onMask }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [, force] = useState(0);

  // (Re)create the mask whenever the image changes.
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    maskRef.current = c;
    onMask(null);
    const v = viewRef.current;
    if (v) {
      v.width = width;
      v.height = height;
      v.getContext("2d")!.clearRect(0, 0, width, height);
    }
    force((n) => n + 1);
  }, [url, width, height, onMask]);

  const paint = (e: React.PointerEvent) => {
    const wrap = wrapRef.current;
    const mask = maskRef.current;
    const view = viewRef.current;
    if (!wrap || !mask || !view) return;
    const r = wrap.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * width;
    const y = ((e.clientY - r.top) / r.height) * height;
    const radius = (brush / 100) * Math.max(width, height) * 0.25;

    for (const [canvas, style] of [
      [mask, "#ffffff"],
      [view, "rgba(56,132,255,0.45)"],
    ] as const) {
      const ctx = canvas.getContext("2d")!;
      const g = ctx.createRadialGradient(x, y, radius * 0.35, x, y, radius);
      g.addColorStop(0, style);
      g.addColorStop(1, style.startsWith("#") ? "rgba(255,255,255,0)" : "rgba(56,132,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    onMask(mask);
  };

  const clear = () => {
    const mask = maskRef.current;
    const view = viewRef.current;
    if (mask) mask.getContext("2d")!.clearRect(0, 0, width, height);
    if (view) view.getContext("2d")!.clearRect(0, 0, width, height);
    onMask(null);
  };

  return (
    <div className="space-y-2">
      <div
        ref={wrapRef}
        className="relative touch-none select-none overflow-hidden rounded-md border border-border bg-muted"
        onPointerDown={(e) => {
          drawing.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          paint(e);
        }}
        onPointerMove={(e) => drawing.current && paint(e)}
        onPointerUp={() => (drawing.current = false)}
        onPointerLeave={() => (drawing.current = false)}
      >
        <img
          src={url}
          alt="blur target"
          draggable={false}
          className="block w-full"
          style={filterCss ? { filter: filterCss } : undefined}
        />
        <canvas
          ref={viewRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Drag over the areas you want blurred.</span>
        <button
          type="button"
          onClick={clear}
          className="rounded border border-input bg-background px-2 py-1 hover:bg-accent"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
