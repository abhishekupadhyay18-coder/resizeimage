import { createFileRoute } from "@tanstack/react-router";
import { FileArchive, FileText, ImageIcon, Layers, ScanLine } from "lucide-react";
import { ToolCard } from "@/components/ToolCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tools Hub — Compress, Convert, Edit PDF & Images" },
      {
        name: "description",
        content:
          "A collection of free browser tools: document image compressor, image editor, PDF editor, file converter and PDF maker. All processing happens on your device.",
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
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tools Hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a tool below. Everything runs in your browser — files never leave your device.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ToolCard
            to="/tools/compress"
            title="Document Image Compressor"
            description="Compress photos to strict KB ranges & merge Aadhaar."
            icon={Layers}
            accent="bg-sky-500"
          />
          <ToolCard
            to="/tools/image"
            title="Image Tools"
            description="Resize, crop, rotate, filter and adjust images."
            icon={ImageIcon}
            accent="bg-violet-500"
          />
          <ToolCard
            to="/tools/pdf"
            title="PDF Tools"
            description="Merge, split, rotate, delete and organize pages."
            icon={FileText}
            accent="bg-rose-500"
          />
          <ToolCard
            to="/tools/convert"
            title="File Converter"
            description="Convert JPG, PNG, WEBP, PDF ↔ Image."
            icon={FileArchive}
            accent="bg-emerald-500"
          />
          <ToolCard
            to="/tools/pdf-maker"
            title="PDF Maker"
            description="Scan with your camera and build a PDF, doc-scanner style."
            icon={ScanLine}
            accent="bg-amber-500"
          />
        </div>

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          All processing happens on your device. Nothing is uploaded.
        </footer>
      </main>
    </div>
  );
}
