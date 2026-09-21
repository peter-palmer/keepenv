import { Undo2 } from "lucide-react";
import { useEffect } from "react";

export interface UndoToastProps {
  readonly message: string;
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
  readonly durationMs?: number;
}

/** A transient bar offering to undo the last destructive edit. */
export function UndoToast({
  message,
  onUndo,
  onDismiss,
  durationMs = 7000,
}: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs, message]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-10 z-40 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-hairline bg-panel px-3.5 py-2 shadow-xl">
        <span className="text-[12.5px] text-ink">{message}</span>
        <button
          type="button"
          onClick={onUndo}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium text-accent transition-colors hover:bg-accent-soft"
        >
          <Undo2 size={13} />
          Undo
        </button>
      </div>
    </div>
  );
}
