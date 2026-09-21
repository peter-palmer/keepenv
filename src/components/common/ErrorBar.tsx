import { CircleAlert, X } from "lucide-react";

export interface ErrorBarProps {
  readonly message: string;
  readonly onDismiss: () => void;
}

/** A non-blocking error strip. Never carries file contents. */
export function ErrorBar({ message, onDismiss }: ErrorBarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-danger/25 bg-danger-soft px-4 py-2 text-[12px] text-danger">
      <CircleAlert size={14} className="shrink-0" />
      <p className="flex-1 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-0.5 transition-colors hover:bg-danger/10"
      >
        <X size={13} />
      </button>
    </div>
  );
}
