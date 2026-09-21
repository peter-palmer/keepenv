import { Plus } from "lucide-react";

import { cn } from "@/lib/cn.ts";
import type { EnvFileInfo } from "@/services/index.ts";

export interface EnvFileTabsProps {
  readonly files: readonly EnvFileInfo[];
  readonly activeFile: string | null;
  /** Files with unsaved edits, shown with a dot. */
  readonly dirtyFiles: ReadonlySet<string>;
  readonly onSelect: (name: string) => void;
  readonly onCreate: () => void;
}

export function EnvFileTabs({
  files,
  activeFile,
  dirtyFiles,
  onSelect,
  onCreate,
}: EnvFileTabsProps) {
  return (
    <div className="scroll-thin flex items-center gap-1 overflow-x-auto">
      {files.map((file) => {
        const isActive = file.name === activeFile;
        return (
          <button
            key={file.name}
            type="button"
            onClick={() => onSelect(file.name)}
            className={cn(
              "group flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5",
              "font-mono text-[12px] transition-colors",
              isActive
                ? "bg-accent-soft text-accent"
                : "text-ink-muted hover:bg-row hover:text-ink",
            )}
          >
            {file.name}
            {dirtyFiles.has(file.name) && (
              <span
                aria-label="Unsaved changes"
                className="h-1.5 w-1.5 rounded-full bg-warn"
              />
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onCreate}
        className={cn(
          "flex h-7 shrink-0 items-center gap-1 rounded-lg px-2",
          "text-[12px] text-ink-subtle transition-colors hover:bg-row hover:text-ink",
        )}
      >
        <Plus size={13} />
        New env file
      </button>
    </div>
  );
}
