import { FolderOpen } from "lucide-react";

import { shortenPath } from "@/lib/format.ts";
import type { EnvFileInfo, Project } from "@/services/index.ts";
import { EnvFileTabs } from "@/components/envfiles/EnvFileTabs.tsx";

export interface ProjectHeaderProps {
  readonly project: Project;
  readonly homeDirectory: string | null;
  readonly files: readonly EnvFileInfo[];
  readonly activeFile: string | null;
  readonly dirtyFiles: ReadonlySet<string>;
  readonly onSelectFile: (name: string) => void;
  readonly onCreateFile: () => void;
  readonly onReveal: () => void;
}

export function ProjectHeader({
  project,
  homeDirectory,
  files,
  activeFile,
  dirtyFiles,
  onSelectFile,
  onCreateFile,
  onReveal,
}: ProjectHeaderProps) {
  return (
    <header
      data-tauri-drag-region
      className="app-chrome shrink-0 border-b border-hairline px-4 pb-2 pt-[38px]"
    >
      <div className="flex items-center gap-2.5 pb-2">
        <h1 className="truncate text-[14px] font-semibold tracking-tight text-ink">
          {project.name}
        </h1>
        <span
          title={project.rootPath}
          className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-subtle"
        >
          {shortenPath(project.rootPath, homeDirectory)}
        </span>
        <button
          type="button"
          onClick={onReveal}
          title="Reveal project in Finder"
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12px] text-ink-muted transition-colors hover:bg-row hover:text-ink"
        >
          <FolderOpen size={13} />
          Reveal
        </button>
      </div>

      <EnvFileTabs
        files={files}
        activeFile={activeFile}
        dirtyFiles={dirtyFiles}
        onSelect={onSelectFile}
        onCreate={onCreateFile}
      />
    </header>
  );
}
