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
      className="group flex aspect-square flex-col items-center justify-center rounded-2xl border border-border bg-card p-4 text-center shadow-sm hover:shadow-md hover:border-primary/40 transition"
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-xl ${accent} text-white shadow-sm group-hover:scale-105 transition-transform`}
      >
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="mt-3 text-sm font-semibold text-foreground leading-tight">
        {title}
      </h2>
      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground leading-snug">
        {description}
      </p>
    </Link>
  );
}
