import { Copy, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn.ts";
import type { Project } from "@/services/index.ts";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/index.ts";

export type DropEdge = "above" | "below" | null;

export interface ProjectRowProps {
  readonly project: Project;
  readonly isActive: boolean;
  readonly isDragging: boolean;
  readonly dropEdge: DropEdge;
  readonly onSelect: () => void;
  readonly onRename: (name: string) => void;
  readonly onReveal: () => void;
  readonly onCopyPath: () => void;
  readonly onRemove: () => void;
  readonly onDragStart: () => void;
  readonly onDragOver: () => void;
  readonly onDragEnd: () => void;
  readonly onDrop: () => void;
}

export function ProjectRow({
  project,
  isActive,
  isDragging,
  dropEdge,
  onSelect,
  onRename,
  onReveal,
  onCopyPath,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: ProjectRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const name = draft.trim();
    setEditing(false);
    if (name.length > 0 && name !== project.name) {
      onRename(name);
    } else {
      setDraft(project.name);
    }
  };

  return (
    <div
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDragEnd={onDragEnd}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={cn(
        "group relative flex items-center gap-1 rounded-lg pl-2.5 pr-1",
        "h-[30px] text-[13px] transition-colors",
        isActive ? "bg-accent text-accent-ink" : "text-ink hover:bg-row",
        isDragging && "opacity-40",
      )}
    >
      {dropEdge !== null && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-1 h-0.5 rounded-full bg-accent",
            dropEdge === "above" ? "-top-px" : "-bottom-px",
          )}
        />
      )}

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          spellCheck={false}
          autoComplete="off"
          data-1p-ignore
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
            }
            if (event.key === "Escape") {
              setDraft(project.name);
              setEditing(false);
            }
          }}
          className="h-[22px] min-w-0 flex-1 rounded border border-accent bg-surface px-1 text-[13px] text-ink focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => setEditing(true)}
          title={project.rootPath}
          className="min-w-0 flex-1 truncate text-left"
        >
          {project.name}
        </button>
      )}

      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${project.name}`}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded",
              "opacity-0 transition-opacity group-hover:opacity-100",
              "data-[state=open]:opacity-100",
              isActive
                ? "hover:bg-black/15"
                : "text-ink-subtle hover:bg-hairline hover:text-ink",
            )}
          >
            <MoreHorizontal size={14} />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            onSelect={() => {
              setDraft(project.name);
              setEditing(true);
            }}
          >
            <Pencil size={14} />
            Rename
          </MenuItem>
          <MenuItem onSelect={onReveal}>
            <FolderOpen size={14} />
            Reveal in Finder
          </MenuItem>
          <MenuItem onSelect={onCopyPath}>
            <Copy size={14} />
            Copy path
          </MenuItem>
          <MenuSeparator />
          <MenuItem tone="danger" onSelect={onRemove}>
            <Trash2 size={14} />
            Remove from Keepenv
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
