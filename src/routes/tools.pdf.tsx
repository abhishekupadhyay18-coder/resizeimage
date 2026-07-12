import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowUpDown,
  FilePlus,
  Loader2,
  RotateCw,
  Scissors,
  Trash2,
  Upload,
} from "lucide-react";
import { ToolShell } from "@/components/ToolShell";
import { ServiceTile } from "@/components/ServiceTile";
import {
  deletePages,
  downloadBytes,
  extractPages,
  mergePdfs,
  parseRanges,
  readPdf,
  reorderPages,
  rotatePdf,
} from "@/lib/pdf-utils";

export const Route = createFileRoute("/tools/pdf")({
  head: () => ({
    meta: [
      { title: "PDF Tools — Tools Hub" },
      {
        name: "description",
        content: "Merge, split, rotate, delete, extract and reorder PDF pages — all in your browser.",
      },
      { property: "og:title", content: "PDF Tools" },
      {
        property: "og:description",
        content: "Client-side PDF editor: merge, split, rotate, delete pages and more.",
      },
    ],
  }),
  component: Page,
});

type Tool = "merge" | "split" | "rotate" | "delete" | "extract" | "reorder";

function Page() {
  const [tool, setTool] = useState<Tool>("merge");
  return (
    <ToolShell
      title="PDF Tools"
      description="Client-side PDF utilities. Files stay on your device."
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <ServiceTile active={tool === "merge"} onClick={() => setTool("merge")} title="Merge" icon={FilePlus} />
        <ServiceTile active={tool === "split"} onClick={() => setTool("split")} title="Split" icon={Scissors} />
        <ServiceTile active={tool === "rotate"} onClick={() => setTool("rotate")} title="Rotate" icon={RotateCw} />
        <ServiceTile active={tool === "delete"} onClick={() => setTool("delete")} title="Delete" icon={Trash2} />
        <ServiceTile active={tool === "extract"} onClick={() => setTool("extract")} title="Extract" icon={Scissors} />
        <ServiceTile active={tool === "reorder"} onClick={() => setTool("reorder")} title="Reorder" icon={ArrowUpDown} />
      </div>

      <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        “Compress PDF” isn't included — high-quality PDF compression needs server-side tooling.
      </div>

      {tool === "merge" && <MergePanel />}
      {tool === "split" && <SplitPanel />}
      {tool === "rotate" && <RotatePanel />}
      {tool === "delete" && <DeletePanel />}
      {tool === "extract" && <ExtractPanel />}
      {tool === "reorder" && <ReorderPanel />}
    </ToolShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function MultiPdfDropzone({ onFiles, files }: { onFiles: (f: File[]) => void; files: File[] }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center hover:bg-muted">
      <Upload className="h-5 w-5 text-muted-foreground" />
      <div className="mt-1 text-sm font-medium">
        {files.length ? `${files.length} PDF(s) selected` : "Drop or click to pick PDFs"}
      </div>
      <input
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />
    </label>
  );
}

function PdfDropzone({ file, onFile }: { file: File | null; onFile: (f: File) => void }) {
  return (
    <label
      className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center hover:bg-muted"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <Upload className="h-5 w-5 text-muted-foreground" />
      <div className="mt-1 text-sm font-medium">{file ? file.name : "Drop or click to pick a PDF"}</div>
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function BusyButton({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function usePageCount(file: File | null): number | null {
  const cacheRef = useRef<Map<File, number>>(new Map());
  const [n, setN] = useState<number | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  if (file !== lastFile) {
    setLastFile(file);
    setN(null);
    if (file) {
      const cached = cacheRef.current.get(file);
      if (cached !== undefined) setN(cached);
      else {
        readPdf(file)
          .then((d) => {
            const c = d.getPageCount();
            cacheRef.current.set(file, c);
            setN(c);
          })
          .catch(() => setN(null));
      }
    }
  }
  return n;
}

function MergePanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Merge PDFs">
      <MultiPdfDropzone files={files} onFiles={setFiles} />
      <BusyButton
        busy={busy}
        disabled={files.length < 2}
        onClick={async () => {
          setBusy(true);
          try {
            const bytes = await mergePdfs(files);
            downloadBytes(bytes, "merged.pdf");
          } finally {
            setBusy(false);
          }
        }}
      >
        Merge & download
      </BusyButton>
    </Card>
  );
}

function SplitPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [ranges, setRanges] = useState("1");
  const [busy, setBusy] = useState(false);
  const count = usePageCount(file);
  return (
    <Card title="Split PDF (extract selected pages as one file)">
      <PdfDropzone file={file} onFile={setFile} />
      {count !== null && <div className="text-xs text-muted-foreground">{count} pages</div>}
      <input
        type="text"
        value={ranges}
        onChange={(e) => setRanges(e.target.value)}
        placeholder="e.g. 1-3,5,8-10"
        className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
      />
      <BusyButton
        busy={busy}
        disabled={!file}
        onClick={async () => {
          if (!file) return;
          setBusy(true);
          try {
            const idx = parseRanges(ranges, count ?? 9999);
            const bytes = await extractPages(file, idx);
            downloadBytes(bytes, "split.pdf");
          } finally {
            setBusy(false);
          }
        }}
      >
        Split & download
      </BusyButton>
    </Card>
  );
}

function RotatePanel() {
  const [file, setFile] = useState<File | null>(null);
  const [deg, setDeg] = useState<90 | 180 | 270>(90);
  const [pages, setPages] = useState("");
  const [busy, setBusy] = useState(false);
  const count = usePageCount(file);
  return (
    <Card title="Rotate PDF pages">
      <PdfDropzone file={file} onFile={setFile} />
      {count !== null && <div className="text-xs text-muted-foreground">{count} pages</div>}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Rotate:</span>
        {([90, 180, 270] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDeg(d)}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              deg === d
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent"
            }`}
          >
            {d}°
          </button>
        ))}
      </div>
      <input
        type="text"
        value={pages}
        onChange={(e) => setPages(e.target.value)}
        placeholder="Pages (blank = all). e.g. 1-3,5"
        className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
      />
      <BusyButton
        busy={busy}
        disabled={!file}
        onClick={async () => {
          if (!file) return;
          setBusy(true);
          try {
            const idx = pages.trim() ? parseRanges(pages, count ?? 9999) : undefined;
            const bytes = await rotatePdf(file, deg, idx);
            downloadBytes(bytes, "rotated.pdf");
          } finally {
            setBusy(false);
          }
        }}
      >
        Rotate & download
      </BusyButton>
    </Card>
  );
}

function DeletePanel() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState("");
  const [busy, setBusy] = useState(false);
  const count = usePageCount(file);
  return (
    <Card title="Delete pages">
      <PdfDropzone file={file} onFile={setFile} />
      {count !== null && <div className="text-xs text-muted-foreground">{count} pages</div>}
      <input
        type="text"
        value={pages}
        onChange={(e) => setPages(e.target.value)}
        placeholder="Pages to delete. e.g. 2,4-5"
        className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
      />
      <BusyButton
        busy={busy}
        disabled={!file || !pages.trim()}
        onClick={async () => {
          if (!file) return;
          setBusy(true);
          try {
            const idx = parseRanges(pages, count ?? 9999);
            const bytes = await deletePages(file, idx);
            downloadBytes(bytes, "trimmed.pdf");
          } finally {
            setBusy(false);
          }
        }}
      >
        Delete & download
      </BusyButton>
    </Card>
  );
}

function ExtractPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState("");
  const [busy, setBusy] = useState(false);
  const count = usePageCount(file);
  return (
    <Card title="Extract pages">
      <PdfDropzone file={file} onFile={setFile} />
      {count !== null && <div className="text-xs text-muted-foreground">{count} pages</div>}
      <input
        type="text"
        value={pages}
        onChange={(e) => setPages(e.target.value)}
        placeholder="Pages to keep. e.g. 1,3-4"
        className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
      />
      <BusyButton
        busy={busy}
        disabled={!file || !pages.trim()}
        onClick={async () => {
          if (!file) return;
          setBusy(true);
          try {
            const idx = parseRanges(pages, count ?? 9999);
            const bytes = await extractPages(file, idx);
            downloadBytes(bytes, "extracted.pdf");
          } finally {
            setBusy(false);
          }
        }}
      >
        Extract & download
      </BusyButton>
    </Card>
  );
}

function ReorderPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const count = usePageCount(file);
  if (file && count && order.length !== count) {
    setOrder(Array.from({ length: count }, (_, i) => i));
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  return (
    <Card title="Reorder pages">
      <PdfDropzone file={file} onFile={(f) => { setFile(f); setOrder([]); }} />
      {count !== null && (
        <div className="max-h-64 overflow-auto rounded-md border border-border">
          {order.map((p, i) => (
            <div key={i} className="flex items-center justify-between border-b border-border px-3 py-1.5 text-sm last:border-0">
              <span>Page {p + 1}</span>
              <div className="flex gap-1">
                <button type="button" className="rounded border border-input px-2 py-0.5 text-xs hover:bg-accent" onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="rounded border border-input px-2 py-0.5 text-xs hover:bg-accent" onClick={() => move(i, 1)}>↓</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <BusyButton
        busy={busy}
        disabled={!file || !order.length}
        onClick={async () => {
          if (!file) return;
          setBusy(true);
          try {
            const bytes = await reorderPages(file, order);
            downloadBytes(bytes, "reordered.pdf");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save order & download
      </BusyButton>
    </Card>
  );
}
