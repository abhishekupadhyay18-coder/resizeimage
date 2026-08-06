import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
}

export function ToolShell({ title, description, children }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-gradient-to-b from-accent/40 to-transparent">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> All tools
            </Link>
            <ThemeToggle />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">{children}</main>
    </div>
  );
}
