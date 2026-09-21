import { Eye, EyeOff, FolderOpen, MoreHorizontal, Search, Trash2 } from "lucide-react";
import type { RefObject } from "react";

import { cn } from "@/lib/cn.ts";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/index.ts";

export type EditorMode = "variables" | "raw";

export interface EditorToolbarProps {
  readonly mode: EditorMode;
  readonly onModeChange: (mode: EditorMode) => void;
  readonly search: string;
  readonly onSearchChange: (search: string) => void;
  readonly searchRef: RefObject<HTMLInputElement | null>;
  readonly revealAll: boolean;
  readonly onToggleRevealAll: () => void;
  readonly isDirty: boolean;
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly onRevealFile: () => void;
  readonly onDeleteFile: () => void;
}

export function EditorToolbar({
  mode,
  onModeChange,
  search,
  onSearchChange,
  searchRef,
  revealAll,
  onToggleRevealAll,
  isDirty,
  saving,
  onSave,
  onRevealFile,
  onDeleteFile,
}: EditorToolbarProps) {
  return (
    <div className="app-chrome flex items-center gap-2 border-b border-hairline px-4 py-2">
      <div className="relative w-[230px]">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          ref={searchRef}
          value={search}
          type="search"
          spellCheck={false}
          autoComplete="off"
          data-1p-ignore
          placeholder="Search variables..."
          aria-label="Search variables by name"
          onChange={(event) => onSearchChange(event.target.value)}
          disabled={mode === "raw"}
          className={cn(
            "h-7 w-full rounded-lg border border-hairline bg-surface pl-7 pr-2.5",
            "text-[12.5px] text-ink placeholder:text-ink-subtle",
            "focus:border-accent focus:outline-none disabled:opacity-40",
          )}
        />
      </div>

      <div className="flex h-7 items-center rounded-lg bg-panel p-0.5 ring-1 ring-hairline ring-inset">
        <ModeButton
          active={mode === "variables"}
          onClick={() => onModeChange("variables")}
        >
          Variables
        </ModeButton>
        <ModeButton active={mode === "raw"} onClick={() => onModeChange("raw")}>
          Raw
        </ModeButton>
      </div>

      <Button
        size="sm"
        variant={revealAll ? "warning" : "secondary"}
        onClick={onToggleRevealAll}
        title={
          revealAll
            ? "Secrets are visible on screen"
            : "Show every value in this file"
        }
      >
        {revealAll ? <Eye size={13} /> : <EyeOff size={13} />}
        {revealAll ? "Revealing all" : "Reveal all"}
      </Button>

      <div className="flex-1" />

      {isDirty && (
        <span className="flex items-center gap-1.5 text-[12px] text-warn">
          <span className="h-1.5 w-1.5 rounded-full bg-warn" />
          Unsaved changes
        </span>
      )}

      <Button
        size="sm"
        variant="primary"
        disabled={!isDirty || saving}
        onClick={onSave}
        title="Save (⌘S)"
      >
        {saving ? "Saving…" : "Save"}
      </Button>

      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="File actions"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-row hover:text-ink"
          >
            <MoreHorizontal size={15} />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onRevealFile}>
            <FolderOpen size={14} />
            Reveal in Finder
          </MenuItem>
          <MenuSeparator />
          <MenuItem tone="danger" onSelect={onDeleteFile}>
            <Trash2 size={14} />
            Move file to Trash…
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-6 rounded-md px-2.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-surface text-ink shadow-sm"
          : "text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
