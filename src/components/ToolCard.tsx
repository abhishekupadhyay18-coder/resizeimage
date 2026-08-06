import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

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
      className="group flex flex-col items-center justify-start rounded-xl border border-border bg-card px-2 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg border ${accent} transition-transform group-hover:scale-105`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h2 className="mt-2 text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
        {title}
      </h2>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
        {description}
      </p>
    </Link>
  );
}
