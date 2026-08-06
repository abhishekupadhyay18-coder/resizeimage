import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const OPTIONS: { key: ThemeMode; icon: typeof Sun; label: string }[] = [
  { key: "light", icon: Sun, label: "Light" },
  { key: "dark", icon: Moon, label: "Dark" },
  { key: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
      {OPTIONS.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          title={label}
          onClick={() => setMode(key)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
            mode === key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
