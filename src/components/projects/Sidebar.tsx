import { FileKey2, Plus } from "lucide-react";
import { useState } from "react";

import type { Project } from "@/services/index.ts";
import { Button } from "@/components/ui/index.ts";

import { ProjectRow } from "./ProjectRow.tsx";
import type { DropEdge } from "./ProjectRow.tsx";

export interface SidebarProps {
  readonly projects: readonly Project[];
  readonly activeProjectId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onAdd: () => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onReveal: (id: string) => void;
  readonly onCopyPath: (project: Project) => void;
  readonly onRemove: (project: Project) => void;
  readonly onReorder: (ids: readonly string[]) => void;
}

/**
 * The project list.
 *
 * Reordering uses native HTML5 drag events — enough for a single vertical
 * list, and it keeps a drag-and-drop library out of the bundle.
 */
export function Sidebar({
  projects,
  activeProjectId,
  onSelect,
  onAdd,
  onRename,
  onReveal,
  onCopyPath,
  onRemove,
  onReorder,
}: SidebarProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const resetDrag = () => {
    setDraggingId(null);
    setOverId(null);
  };

  const commitDrop = () => {
    if (draggingId === null || overId === null || draggingId === overId) {
      resetDrag();
      return;
    }
    const ids = projects.map((project) => project.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(overId);
    const moved = ids[from];
    if (from === -1 || to === -1 || moved === undefined) {
      resetDrag();
      return;
    }
    ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
    resetDrag();
  };

  const edgeFor = (id: string): DropEdge => {
    if (draggingId === null || overId !== id || draggingId === id) {
      return null;
    }
    const ids = projects.map((project) => project.id);
    return ids.indexOf(draggingId) < ids.indexOf(id) ? "below" : "above";
  };

  return (
    <aside className="app-chrome flex w-[232px] shrink-0 flex-col border-r border-hairline bg-sidebar">
      {/* Clears the macOS traffic lights and gives the window a drag handle. */}
      <div data-tauri-drag-region className="h-[38px] shrink-0" />

      <div className="flex items-center gap-2 px-3.5 pb-3">
        <FileKey2 size={15} className="text-accent" />
        <span className="text-[13px] font-semibold tracking-tight text-ink">
          Keepenv
        </span>
      </div>

      <div className="px-3.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
        Projects
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-2 pb-2">
        {projects.length === 0 ? (
          <p className="px-1.5 py-2 text-[12px] leading-relaxed text-ink-subtle">
            No projects yet.
          </p>
        ) : (
          projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              isDragging={draggingId === project.id}
              dropEdge={edgeFor(project.id)}
              onSelect={() => onSelect(project.id)}
              onRename={(name) => onRename(project.id, name)}
              onReveal={() => onReveal(project.id)}
              onCopyPath={() => onCopyPath(project)}
              onRemove={() => onRemove(project)}
              onDragStart={() => setDraggingId(project.id)}
              onDragOver={() => setOverId(project.id)}
              onDragEnd={resetDrag}
              onDrop={commitDrop}
            />
          ))
        )}
      </nav>

      <div className="border-t border-hairline p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAdd}
          className="w-full justify-start"
        >
          <Plus size={14} />
          Add project
        </Button>
      </div>
    </aside>
  );
}
