import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SectionCard } from "@/components/SectionCard";
import { AadhaarSection } from "@/components/AadhaarSection";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [cropSensitivity, setCropSensitivity] = useState(50);

  const label =
    cropSensitivity === 0
      ? "Off"
      : cropSensitivity < 30
        ? "Gentle"
        : cropSensitivity < 65
          ? "Balanced"
          : cropSensitivity < 90
            ? "Aggressive"
            : "Maximum";

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
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">Auto-crop sensitivity</div>
              <div className="text-xs text-muted-foreground">
                Applied when you upload or press Auto crop. 0 disables trimming.
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums text-foreground">
                {cropSensitivity}
              </div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={cropSensitivity}
            onChange={(e) => setCropSensitivity(Number(e.target.value))}
            className="mt-3 w-full accent-primary"
            aria-label="Auto-crop sensitivity"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Off</span>
            <span>Gentle</span>
            <span>Balanced</span>
            <span>Aggressive</span>
            <span>Max</span>
          </div>
        </div>

        <SectionCard
          title="Passport Size Photograph"
          description="Your passport photo, auto-compressed."
          minKB={40}
          maxKB={45}
          downloadName="passport.jpg"
          accent="bg-sky-500"
          cropSensitivity={cropSensitivity}
        />
        <SectionCard
          title="Ghosna Patra"
          description="Declaration document image."
          minKB={90}
          maxKB={95}
          downloadName="ghosna-patra.jpg"
          accent="bg-violet-500"
          cropSensitivity={cropSensitivity}
        />
        <AadhaarSection cropSensitivity={cropSensitivity} />

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          All processing happens on your device. Nothing is uploaded.
        </footer>
      </main>
    </div>
  );
}
