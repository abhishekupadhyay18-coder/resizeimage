import type { LucideIcon } from "lucide-react";

interface Props {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: LucideIcon;
}

export function ServiceTile({ active, onClick, title, icon: Icon }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent/50 text-foreground"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <span className="text-xs font-medium leading-tight">{title}</span>
    </button>
  );
}
