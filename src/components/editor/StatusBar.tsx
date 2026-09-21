import { cn } from "@/lib/cn.ts";
import { formatBytes } from "@/lib/format.ts";
import type { GitIgnoreState } from "@/services/index.ts";

import { GitBadge } from "./GitBadge.tsx";

export interface StatusBarProps {
  readonly gitState: GitIgnoreState | null;
  readonly variableCount: number;
  readonly sizeBytes: number;
  readonly isDirty: boolean;
}

export function StatusBar({
  gitState,
  variableCount,
  sizeBytes,
  isDirty,
}: StatusBarProps) {
  return (
    <footer className="app-chrome flex h-7 shrink-0 items-center gap-3 border-t border-hairline bg-panel px-4 text-[11.5px] text-ink-muted">
      <GitBadge state={gitState} />
      <div className="flex-1" />
      <span>
        {variableCount} {variableCount === 1 ? "variable" : "variables"}
      </span>
      <span className="text-ink-subtle">{formatBytes(sizeBytes)}</span>
      <span className={cn(isDirty ? "text-warn" : "text-ok")}>
        {isDirty ? "Modified" : "Saved"}
      </span>
    </footer>
  );
}
