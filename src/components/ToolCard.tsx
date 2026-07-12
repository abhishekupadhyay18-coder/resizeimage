import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

interface Props {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}

export function ToolCard({ to, title, description, icon: Icon, accent }: Props) {
  return (
    <Link
      to={to}
      className="group block rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${accent} text-white shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}
