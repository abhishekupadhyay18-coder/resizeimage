import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCard, type SectionOutput } from "@/components/SectionCard";
import { AadhaarSection } from "@/components/AadhaarSection";
import { ToolShell } from "@/components/ToolShell";
import { canShareFiles, downloadAll, shareAll } from "@/lib/share";

export const Route = createFileRoute("/tools/compress")({
  head: () => ({
    meta: [
      { title: "Document Image Compressor — Tools Hub" },
      {
        name: "description",
        content:
          "Compress images to strict KB ranges (40–45 KB, 90–95 KB), merge two images into one file, then download or share them all at once.",
      },
      { property: "og:title", content: "Document Image Compressor" },
      {
        property: "og:description",
        content: "Compress photos to strict KB targets — sharp, in-browser, ready to upload.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const [out50, setOut50] = useState<SectionOutput | null>(null);
  const [out100, setOut100] = useState<SectionOutput | null>(null);
  const [outMerged, setOutMerged] = useState<SectionOutput | null>(null);

  const handle50 = useCallback((o: SectionOutput | null) => setOut50(o), []);
  const handle100 = useCallback((o: SectionOutput | null) => setOut100(o), []);
  const handleMerged = useCallback((o: SectionOutput | null) => setOutMerged(o), []);

  const files = [out50, out100, outMerged].filter(Boolean) as SectionOutput[];
  const shareable = files.length > 0 && canShareFiles(files);

  return (
    <ToolShell
      title="Document Image Compressor"
      description="Compress images to strict KB ranges — sharp and clear, ready to upload. Upload, drop, or capture with your camera; adjust rotation and crop, then apply."
    >
      {files.length > 0 && (
        <div className="sticky top-2 z-20 rounded-xl border border-primary/40 bg-primary/5 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-semibold text-foreground">
                {files.length} file{files.length > 1 ? "s" : ""} ready
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {files.map((f) => f.name).join(", ")}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  await downloadAll(files);
                  toast.success(`Downloading ${files.length} file(s)`);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
              >
                <Download className="h-4 w-4" /> Download all
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await shareAll(files, "Compressed images");
                  if (!ok) {
                    toast.info("Sharing isn't supported here — downloading instead.");
                    await downloadAll(files);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                <Share2 className="h-4 w-4" /> Share all
              </button>
            </div>
          </div>
          {!shareable && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Share opens your device share sheet (WhatsApp, Mail…) on supported browsers. Files are
              shared exactly as compressed — no quality loss.
            </p>
          )}
        </div>
      )}

      <SectionCard
        title="Image under 50 KB"
        description="Compress any image to a strict 40–45 KB range."
        minKB={40}
        maxKB={45}
        downloadBase="image50"
        accent="bg-sky-500"
        dpi
        onOutput={handle50}
      />
      <SectionCard
        title="Image under 100 KB"
        description="Compress any image to a strict 90–95 KB range."
        minKB={90}
        maxKB={95}
        downloadBase="image100"
        accent="bg-violet-500"
        onOutput={handle100}
      />
      <AadhaarSection onOutput={handleMerged} />
    </ToolShell>
  );
}
