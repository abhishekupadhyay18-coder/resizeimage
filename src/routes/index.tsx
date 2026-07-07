import { createFileRoute } from "@tanstack/react-router";
import { SectionCard } from "@/components/SectionCard";
import { AadhaarSection } from "@/components/AadhaarSection";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Document Image Compressor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compress passport photo, Ghosna Patra, and Aadhaar card to strict KB ranges — sharp
            and clear, ready to upload.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <SectionCard
          title="Passport Size Photograph"
          description="Your passport photo, auto-compressed."
          minKB={40}
          maxKB={45}
          downloadName="passport.jpg"
          accent="bg-sky-500"
        />
        <SectionCard
          title="Ghosna Patra"
          description="Declaration document image."
          minKB={90}
          maxKB={95}
          downloadName="ghosna-patra.jpg"
          accent="bg-violet-500"
        />
        <AadhaarSection />

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          All processing happens on your device. Nothing is uploaded.
        </footer>
      </main>
    </div>
  );
}
