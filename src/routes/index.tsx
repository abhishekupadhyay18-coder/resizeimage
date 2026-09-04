import { createFileRoute } from "@tanstack/react-router";
import {
  FileArchive,
  FileText,
  ImageIcon,
  Layers,
  ScanLine,
} from "lucide-react";
import { ToolCard } from "@/components/ToolCard";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tools Hub — Compress, Convert, Edit PDF & Images" },
      {
        name: "description",
        content:
          "A collection of free browser tools: document image compressor, image editor, complete PDF tools, file converter and PDF maker. All processing happens on your device.",
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

const TOOLS = [
  {
    to: "/tools/compress",
    title: "Document Image Compressor",
    description: "Strict KB sizes & merge two images.",
    icon: Layers,
    accent: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    to: "/tools/image",
    title: "Image Tools",
    description: "Crop, rotate, text, filters, compress.",
    icon: ImageIcon,
    accent: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    to: "/tools/pdf",
    title: "PDF Tools",
    description: "Edit, compress, merge, split & organize.",
    icon: FileText,
    accent: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    to: "/tools/convert",
    title: "File Converter",
    description: "JPG, PNG, WEBP, PDF ↔ Image.",
    icon: FileArchive,
    accent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    to: "/tools/pdf-maker",
    title: "PDF Maker",
    description: "Scan with camera, build a PDF.",
    icon: ScanLine,
    accent: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-gradient-to-b from-accent/40 to-transparent">
        <div className="mx-auto flex max-w-4xl items-start justify-between gap-3 px-4 py-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Tools Hub</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a tool below. Everything runs in your browser — files never leave your device.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
          {TOOLS.map((t) => (
            <ToolCard key={t.to} {...t} />
          ))}
        </div>

        <footer className="pt-8 text-center text-xs text-muted-foreground">
          All processing happens on your device. Nothing is uploaded.
        </footer>
      </main>
    </div>
  );
}
