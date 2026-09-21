import { FileKey2, FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/index.ts";

export interface EmptyProjectsProps {
  readonly onAdd: () => void;
}

/** Shown on first run, before any project has been added. */
export function EmptyProjects({ onAdd }: EmptyProjectsProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <FileKey2 size={26} />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-[17px] font-semibold tracking-tight text-ink">
          Your environment files, in one place.
        </h1>
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">
          Add a project folder to start managing its environment variables.
        </p>
      </div>
      <Button variant="primary" onClick={onAdd}>
        <FolderPlus size={14} />
        Select project folder
      </Button>
      <p className="max-w-xs text-[11.5px] leading-relaxed text-ink-subtle">
        Everything stays on this Mac. Keepenv reads and writes your{" "}
        <span className="font-mono">.env</span> files directly and never copies
        their contents anywhere.
      </p>
    </div>
  );
}

export interface EmptyEnvFilesProps {
  readonly projectName: string;
  readonly onCreate: () => void;
}

/** Shown for a project whose root has no environment files. */
export function EmptyEnvFiles({ projectName, onCreate }: EmptyEnvFilesProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="text-[14px] font-medium text-ink">
        No environment files in {projectName}
      </p>
      <p className="max-w-sm text-[12.5px] leading-relaxed text-ink-muted">
        Keepenv looks for <span className="font-mono">.env</span> and{" "}
        <span className="font-mono">.env.*</span> files in the project root.
        Subfolders are not searched.
      </p>
      <Button variant="primary" size="sm" onClick={onCreate}>
        Create .env file
      </Button>
    </div>
  );
}
