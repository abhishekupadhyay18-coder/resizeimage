import { createFileRoute } from "@tanstack/react-router";
import { SectionCard } from "@/components/SectionCard";
import { AadhaarSection } from "@/components/AadhaarSection";
import { ToolShell } from "@/components/ToolShell";

export const Route = createFileRoute("/tools/compress")({
  head: () => ({
    meta: [
      { title: "Document Image Compressor — Tools Hub" },
      {
        name: "description",
        content:
          "Compress images to strict KB ranges (40–45 KB, 90–95 KB) and merge Aadhaar front & back in one file.",
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
  return (
    <ToolShell
      title="Document Image Compressor"
      description="Compress images to strict KB ranges — sharp and clear, ready to upload. Upload, drop, or capture with your camera; adjust rotation and crop, then apply."
    >
      <SectionCard
        title="Image under 50 KB"
        description="Compress any image to a strict 40–45 KB range."
        minKB={40}
        maxKB={45}
        downloadBase="image50"
        accent="bg-sky-500"
        dpi
      />
      <SectionCard
        title="Image under 100 KB"
        description="Compress any image to a strict 90–95 KB range."
        minKB={90}
        maxKB={95}
        downloadBase="image100"
        accent="bg-violet-500"
      />
      <AadhaarSection />
    </ToolShell>
  );
}
