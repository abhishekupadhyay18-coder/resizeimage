import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Copy,
  Move,
  Trash2,
  Type,
} from "lucide-react";

export interface TextBox {
  id: string;
  text: string;
  /** fractions of image size (0..1) */
  x: number;
  y: number;
  /** width as a fraction of image width (used for wrapping/alignment) */
  w: number;
  /** font size as a fraction of image height */
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  font: string;
  outline: boolean;
  bg: boolean;
  bgColor: string;
  opacity: number;
  align: "left" | "center" | "right";
  letterSpacing: number;
  rotation: number;
}

export const FONTS = [
  { label: "Sans", value: "system-ui, -apple-system, Segoe UI, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, 'Courier New', monospace" },
  { label: "Rounded", value: "'Trebuchet MS', Verdana, sans-serif" },
  { label: "Impact", value: "Impact, 'Arial Black', sans-serif" },
  { label: "Palatino", value: "'Palatino Linotype', Palatino, serif" },
];

export function newTextBox(x: number, y: number): TextBox {
  return {
    id: Math.random().toString(36).slice(2),
    text: "",
    x,
    y,
    w: 0.5,
    size: 0.07,
    color: "#ffffff",
    bold: true,
    italic: false,
    underline: false,
    font: FONTS[0].value,
    outline: true,
    bg: false,
    bgColor: "#000000",
    opacity: 1,
    align: "left",
    letterSpacing: 0,
    rotation: 0,
  };
}

/** Bake the text boxes into the canvas exactly as previewed. */
export function drawTextBoxes(canvas: HTMLCanvasElement, boxes: TextBox[]) {
  const ctx = canvas.getContext("2d")!;
  for (const b of boxes) {
    if (!b.text.trim()) continue;
    const px = b.size * canvas.height;
    const lines = b.text.split("\n");
    ctx.save();
    ctx.globalAlpha = b.opacity;
    ctx.font = `${b.italic ? "italic " : ""}${b.bold ? "bold " : ""}${px}px ${b.font}`;
    ctx.textBaseline = "top";
    ctx.textAlign = b.align;
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${b.letterSpacing * px}px`;
    }
    const originX = b.x * canvas.width;
    const originY = b.y * canvas.height;
    ctx.translate(originX, originY);
    if (b.rotation) ctx.rotate((b.rotation * Math.PI) / 180);
    const lineH = px * 1.18;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const offX = b.align === "center" ? widest / 2 : b.align === "right" ? widest : 0;

    if (b.bg) {
      ctx.fillStyle = b.bgColor;
      const pad = px * 0.16;
      const left = b.align === "center" ? -widest / 2 : b.align === "right" ? -widest : 0;
      ctx.fillRect(left - pad, -pad, widest + pad * 2, lineH * lines.length + pad * 2);
    }

    lines.forEach((line, i) => {
      const ly = i * lineH;
      if (b.outline) {
        ctx.lineWidth = Math.max(1, px / 12);
        ctx.strokeStyle = "rgba(0,0,0,0.65)";
        ctx.lineJoin = "round";
        ctx.strokeText(line, offX, ly);
      }
      ctx.fillStyle = b.color;
      ctx.fillText(line, offX, ly);
      if (b.underline) {
        const wLine = ctx.measureText(line).width;
        const lx = b.align === "center" ? offX - wLine / 2 : b.align === "right" ? offX - wLine : offX;
        ctx.fillRect(lx, ly + px * 1.02, wLine, Math.max(1, px / 16));
      }
    });
    ctx.restore();
  }
}

interface Props {
  url: string;
  boxes: TextBox[];
  onChange: (boxes: TextBox[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  filterCss?: string | null;
}

/**
 * Interactive on-image text layer. One click on the image adds a box with a
 * blinking caret; the badge at the top-right corner moves it, the bottom-right
 * dot resizes it.
 */
export function TextLayer({
  url,
  boxes,
  onChange,
  selectedId,
  onSelect,
  filterCss,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapH, setWrapH] = useState(0);
  const focusNext = useRef<string | null>(null);
  const boxesRef = useRef(boxes);
  const [drag, setDrag] = useState<
    | { id: string; mode: "move"; dx: number; dy: number }
    | { id: string; mode: "resize"; startY: number; startSize: number }
    | null
  >(null);

  useEffect(() => {
    boxesRef.current = boxes;
  }, [boxes]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWrapH(el.getBoundingClientRect().height));
    ro.observe(el);
    setWrapH(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [url]);

  // Put the caret in a freshly created box.
  useEffect(() => {
    if (!focusNext.current) return;
    const id = focusNext.current;
    const el = wrapRef.current?.querySelector<HTMLElement>(`[data-box="${id}"]`);
    if (el) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      focusNext.current = null;
    }
  }, [boxes]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      onChange(
        boxesRef.current.map((b) => {
          if (b.id !== drag.id) return b;
          if (drag.mode === "move") {
            return {
              ...b,
              x: Math.min(1 - b.w, Math.max(0, (e.clientX - r.left) / r.width - drag.dx)),
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
  }, [drag, onChange]);

  const addAt = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-box]")) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const box = newTextBox((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    onChange([...boxes, box]);
    onSelect(box.id);
    focusNext.current = box.id;
  };

  return (
    <div
      ref={wrapRef}
      className="relative select-none overflow-hidden rounded-md border border-border bg-muted"
      onClick={addAt}
    >
      <img
        src={url}
        alt="canvas"
        className="block w-full"
        draggable={false}
        style={filterCss ? { filter: filterCss } : undefined}
      />
      {boxes.map((b) => (
        <div
          key={b.id}
          data-box={b.id}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => onSelect(b.id)}
          onInput={(e) =>
            onChange(
              boxes.map((x) =>
                x.id === b.id
                  ? { ...x, text: (e.target as HTMLElement).innerText.replace(/\n$/, "") }
                  : x,
              ),
            )
          }
          onClick={(e) => {
            e.stopPropagation();
            onSelect(b.id);
          }}
          className={`absolute min-w-[1ch] cursor-text whitespace-pre outline-none ${
            selectedId === b.id ? "ring-2 ring-primary" : "ring-1 ring-white/30"
          }`}
          style={{
            left: `${b.x * 100}%`,
            top: `${b.y * 100}%`,
            fontSize: `${Math.max(6, b.size * wrapH)}px`,
            color: b.color,
            opacity: b.opacity,
            fontWeight: b.bold ? 700 : 400,
            fontStyle: b.italic ? "italic" : "normal",
            textDecoration: b.underline ? "underline" : "none",
            fontFamily: b.font,
            textAlign: b.align,
            letterSpacing: `${b.letterSpacing}em`,
            background: b.bg ? b.bgColor : "transparent",
            padding: b.bg ? "0.16em" : 0,
            textShadow: b.outline ? "0 0 3px rgba(0,0,0,.75)" : undefined,
            transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
            transformOrigin: "top left",
            lineHeight: 1.18,
          }}
        >
          {b.text}
        </div>
      ))}
      {/* Move badges sit outside the editable node so typing is never disturbed */}
      {boxes.map((b) =>
        selectedId === b.id ? (
          <span key={`h-${b.id}`}>
            <button
              type="button"
              aria-label="Move text"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.stopPropagation();
                const r = wrapRef.current!.getBoundingClientRect();
                setDrag({
                  id: b.id,
                  mode: "move",
                  dx: (e.clientX - r.left) / r.width - b.x,
                  dy: (e.clientY - r.top) / r.height - b.y,
                });
              }}
              className="absolute z-10 flex h-6 w-6 -translate-y-1/2 translate-x-1 cursor-move items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow"
              style={{
                left: `calc(${b.x * 100}% + ${measureWidth(b, wrapH)}px)`,
                top: `${b.y * 100}%`,
              }}
            >
              <Move className="h-3 w-3" />
            </button>
            <span
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.stopPropagation();
                setDrag({ id: b.id, mode: "resize", startY: e.clientY, startSize: b.size });
              }}
              className="absolute z-10 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-background bg-primary shadow"
              style={{
                left: `calc(${b.x * 100}% + ${measureWidth(b, wrapH)}px)`,
                top: `calc(${b.y * 100}% + ${b.size * wrapH * 1.18}px)`,
              }}
            />
          </span>
        ) : null,
      )}
      {boxes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-foreground">
            <Type className="mr-1 inline h-3 w-3" /> Click the image to add text
          </span>
        </div>
      )}
    </div>
  );
}

/** Rough on-screen width of a box, used to park the handles at its corner. */
function measureWidth(b: TextBox, wrapH: number) {
  const px = Math.max(6, b.size * wrapH);
  const longest = b.text.split("\n").reduce((m, l) => Math.max(m, l.length), 1);
  return Math.max(px * 0.8, longest * px * 0.52);
}

export function TextLayerList({
  boxes,
  selectedId,
  onSelect,
  onChange,
}: {
  boxes: TextBox[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (b: TextBox[]) => void;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= boxes.length) return;
    const next = boxes.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="rounded-md border border-border bg-muted/30 p-2">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>Text layers</span>
        <span>{boxes.length}</span>
      </div>
      {boxes.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No text yet.</p>
      ) : (
        <ul className="space-y-1">
          {boxes.map((b, i) => (
            <li
              key={b.id}
              onClick={() => onSelect(b.id)}
              className={`flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-[11px] ${
                selectedId === b.id ? "bg-primary/15 text-primary" : "hover:bg-accent"
              }`}
            >
              <span className="truncate">
                Text {i + 1}
                {b.text ? ` · ${b.text.slice(0, 12)}` : ""}
              </span>
              <span className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={(e) => {
                    e.stopPropagation();
                    move(i, -1);
                  }}
                  className="rounded p-0.5 hover:bg-background"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={(e) => {
                    e.stopPropagation();
                    move(i, 1);
                  }}
                  className="rounded p-0.5 hover:bg-background"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label="Delete text"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(boxes.filter((x) => x.id !== b.id));
                    if (selectedId === b.id) onSelect(null);
                  }}
                  className="rounded p-0.5 text-destructive hover:bg-background"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TextBoxControls({
  box,
  onChange,
  onDelete,
  onDuplicate,
}: {
  box: TextBox;
  onChange: (b: TextBox) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
      <textarea
        value={box.text}
        onChange={(e) => onChange({ ...box, text: e.target.value })}
        rows={2}
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
        placeholder="Type text…"
      />
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <select
          value={box.font}
          onChange={(e) => onChange({ ...box, font: e.target.value })}
          className="rounded border border-input bg-background px-1.5 py-1"
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          type="color"
          aria-label="Text colour"
          value={box.color}
          onChange={(e) => onChange({ ...box, color: e.target.value })}
          className="h-7 w-8 rounded border border-input"
        />
        <Toggle on={box.bold} onClick={() => onChange({ ...box, bold: !box.bold })}>
          B
        </Toggle>
        <Toggle on={box.italic} onClick={() => onChange({ ...box, italic: !box.italic })}>
          <span className="italic">I</span>
        </Toggle>
        <Toggle
          on={box.underline}
          onClick={() => onChange({ ...box, underline: !box.underline })}
        >
          <span className="underline">U</span>
        </Toggle>
        <Toggle on={box.outline} onClick={() => onChange({ ...box, outline: !box.outline })}>
          Outline
        </Toggle>
        <Toggle on={box.bg} onClick={() => onChange({ ...box, bg: !box.bg })}>
          BG
        </Toggle>
        {box.bg && (
          <input
            type="color"
            aria-label="Background colour"
            value={box.bgColor}
            onChange={(e) => onChange({ ...box, bgColor: e.target.value })}
            className="h-7 w-8 rounded border border-input"
          />
        )}
        <span className="flex items-center gap-0.5">
          {(["left", "center", "right"] as const).map((a) => (
            <Toggle key={a} on={box.align === a} onClick={() => onChange({ ...box, align: a })}>
              {a === "left" ? (
                <AlignLeft className="h-3 w-3" />
              ) : a === "center" ? (
                <AlignCenter className="h-3 w-3" />
              ) : (
                <AlignRight className="h-3 w-3" />
              )}
            </Toggle>
          ))}
        </span>
      </div>
      <MiniSlider
        label="Size"
        value={Math.round(box.size * 100)}
        min={2}
        max={40}
        onChange={(v) => onChange({ ...box, size: v / 100 })}
        suffix="%"
      />
      <MiniSlider
        label="Opacity"
        value={Math.round(box.opacity * 100)}
        min={10}
        max={100}
        onChange={(v) => onChange({ ...box, opacity: v / 100 })}
        suffix="%"
      />
      <MiniSlider
        label="Letter spacing"
        value={Math.round(box.letterSpacing * 100)}
        min={-10}
        max={50}
        onChange={(v) => onChange({ ...box, letterSpacing: v / 100 })}
      />
      <MiniSlider
        label="Rotation"
        value={box.rotation}
        min={-180}
        max={180}
        onChange={(v) => onChange({ ...box, rotation: v })}
        suffix="°"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onDuplicate}
          className="inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-[11px] hover:bg-accent"
        >
          <Copy className="h-3 w-3" /> Duplicate
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-[11px] text-destructive hover:bg-accent"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-1.5 py-1 ${
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function MiniSlider({
  label,
  value,
  min,
  max,
  onChange,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
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
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-primary"
      />
    </div>
  );
}
