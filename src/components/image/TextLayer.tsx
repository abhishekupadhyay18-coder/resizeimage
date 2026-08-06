import { useEffect, useRef, useState } from "react";
import { Trash2, Type } from "lucide-react";

export interface TextBox {
  id: string;
  text: string;
  /** fractions of image size (0..1) */
  x: number;
  y: number;
  /** font size as a fraction of image height */
  size: number;
  color: string;
  bold: boolean;
  font: string;
  outline: boolean;
}

const FONTS = [
  { label: "Sans", value: "system-ui, -apple-system, Segoe UI, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, 'Courier New', monospace" },
  { label: "Rounded", value: "'Trebuchet MS', Verdana, sans-serif" },
];

export function drawTextBoxes(
  canvas: HTMLCanvasElement,
  boxes: TextBox[],
) {
  const ctx = canvas.getContext("2d")!;
  for (const b of boxes) {
    const px = b.size * canvas.height;
    ctx.font = `${b.bold ? "bold " : ""}${px}px ${b.font}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = b.color;
    if (b.outline) {
      ctx.lineWidth = Math.max(1, px / 14);
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeText(b.text, b.x * canvas.width, b.y * canvas.height);
    }
    ctx.fillText(b.text, b.x * canvas.width, b.y * canvas.height);
  }
}

interface Props {
  url: string;
  boxes: TextBox[];
  onChange: (boxes: TextBox[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** Interactive on-image text layer: click to place, drag to move, handle to resize. */
export function TextLayer({ url, boxes, onChange, selectedId, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapH, setWrapH] = useState(0);
  const [drag, setDrag] = useState<
    | { id: string; mode: "move"; dx: number; dy: number }
    | { id: string; mode: "resize"; startY: number; startSize: number }
    | null
  >(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWrapH(el.getBoundingClientRect().height));
    ro.observe(el);
    setWrapH(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [url]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      onChange(
        boxes.map((b) => {
          if (b.id !== drag.id) return b;
          if (drag.mode === "move") {
            return {
              ...b,
              x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width - drag.dx)),
              y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height - drag.dy)),
            };
          }
          const delta = (e.clientY - drag.startY) / r.height;
          return { ...b, size: Math.min(0.6, Math.max(0.02, drag.startSize + delta)) };
        }),
      );
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, boxes, onChange]);

  const addAt = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const id = Math.random().toString(36).slice(2);
    onChange([
      ...boxes,
      {
        id,
        text: "Double-click to edit",
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
        size: 0.06,
        color: "#ffffff",
        bold: true,
        font: FONTS[0].value,
        outline: true,
      },
    ]);
    onSelect(id);
  };

  return (
    <div
      ref={wrapRef}
      className="relative select-none overflow-hidden rounded-md border border-border bg-muted"
      onDoubleClick={addAt}
    >
      <img src={url} alt="canvas" className="block w-full" draggable={false} />
      {boxes.map((b) => (
        <div
          key={b.id}
          onPointerDown={(e) => {
            const el = wrapRef.current!;
            const r = el.getBoundingClientRect();
            onSelect(b.id);
            setDrag({
              id: b.id,
              mode: "move",
              dx: (e.clientX - r.left) / r.width - b.x,
              dy: (e.clientY - r.top) / r.height - b.y,
            });
          }}
          className={`absolute cursor-move whitespace-pre ${
            selectedId === b.id ? "outline outline-2 outline-primary" : ""
          }`}
          style={{
            left: `${b.x * 100}%`,
            top: `${b.y * 100}%`,
            fontSize: `${Math.max(6, b.size * wrapH)}px`,
            color: b.color,
            fontWeight: b.bold ? 700 : 400,
            fontFamily: b.font,
            textShadow: b.outline ? "0 0 3px rgba(0,0,0,.7)" : undefined,
            lineHeight: 1,
          }}
        >
          {b.text || " "}
          {selectedId === b.id && (
            <span
              onPointerDown={(e) => {
                e.stopPropagation();
                setDrag({ id: b.id, mode: "resize", startY: e.clientY, startSize: b.size });
              }}
              className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-background bg-primary"
            />
          )}
        </div>
      ))}
      {boxes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground">
            <Type className="mr-1 inline h-3 w-3" /> Double-click the image to add text
          </span>
        </div>
      )}
    </div>
  );
}

export function TextBoxControls({
  box,
  onChange,
  onDelete,
}: {
  box: TextBox;
  onChange: (b: TextBox) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <textarea
        value={box.text}
        onChange={(e) => onChange({ ...box, text: e.target.value })}
        rows={2}
        className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
        placeholder="Type text…"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={box.font}
          onChange={(e) => onChange({ ...box, font: e.target.value })}
          className="rounded border border-input bg-background px-2 py-1"
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          type="color"
          value={box.color}
          onChange={(e) => onChange({ ...box, color: e.target.value })}
          className="h-7 w-10"
        />
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={box.bold}
            onChange={(e) => onChange({ ...box, bold: e.target.checked })}
          />
          Bold
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={box.outline}
            onChange={(e) => onChange({ ...box, outline: e.target.checked })}
          />
          Outline
        </label>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto inline-flex items-center gap-1 rounded border border-input px-2 py-1 hover:bg-accent"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">
          Size: {(box.size * 100).toFixed(0)}%
        </label>
        <input
          type="range"
          min={2}
          max={40}
          value={box.size * 100}
          onChange={(e) => onChange({ ...box, size: +e.target.value / 100 })}
          className="w-full accent-primary"
        />
      </div>
    </div>
  );
}
