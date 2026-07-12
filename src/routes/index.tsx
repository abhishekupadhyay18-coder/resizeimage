import { createFileRoute } from "@tanstack/react-router";
import { FileArchive, FileText, ImageIcon, Layers } from "lucide-react";
import { ToolCard } from "@/components/ToolCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tools Hub — Compress, Convert, Edit PDF & Images" },
      {
        name: "description",
        content:
          "A collection of free browser tools: document image compressor, file converters, PDF editor, and image editor. All processing happens on your device.",
      },
      { property: "og:title", content: "Tools Hub — Compress, Convert, Edit PDF & Images" },
      {
        property: "og:description",
        content: "Free browser tools for compressing, converting and editing images and PDFs.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tools Hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a tool below. Everything runs in your browser — files never leave your device.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <ToolCard
          to="/tools/compress"
          title="Document Image Compressor"
          description="Compress photos to strict KB ranges (50 KB / 100 KB) and merge Aadhaar front & back."
          icon={Layers}
          accent="bg-sky-500"
        />
        <ToolCard
          to="/tools/convert"
          title="File Converter"
          description="Convert between JPG, PNG, WEBP, PDF ↔ Image, and more."
          icon={FileArchive}
          accent="bg-emerald-500"
        />
        <ToolCard
          to="/tools/pdf"
          title="PDF Tools"
          description="Merge, split, rotate, delete, extract and reorder PDF pages."
          icon={FileText}
          accent="bg-rose-500"
        />
        <ToolCard
          to="/tools/image"
          title="Image Tools"
          description="Resize, crop, rotate, flip, filter and adjust images."
          icon={ImageIcon}
          accent="bg-violet-500"
        />

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          All processing happens on your device. Nothing is uploaded.
        </footer>
      </main>
    </div>
  );
}
