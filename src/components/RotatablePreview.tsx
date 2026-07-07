import { RotateCcw, RotateCw, X } from "lucide-react";

interface Props {
  url: string;
  label?: string;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onClear?: () => void;
  disabled?: boolean;
}

export function RotatablePreview({
  url,
  label,
  onRotateLeft,
  onRotateRight,
  onClear,
  disabled,
}: Props) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      )}
      <div className="relative overflow-hidden rounded-md border border-border bg-muted">
        <img src={url} alt={label ?? "preview"} className="mx-auto max-h-64 object-contain" />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRotateLeft}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Left
        </button>
        <button
          type="button"
          onClick={onRotateRight}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          <RotateCw className="h-3.5 w-3.5" /> Right
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}
