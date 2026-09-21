import { useEffect, useRef, useState } from "react";

import { fireAndForget } from "@/lib/async.ts";
import { countVariables, removeNode } from "@/lib/env/index.ts";
import type { GitIgnoreState, Project } from "@/services/index.ts";
import { revealEnvFile, revealProject } from "@/services/index.ts";
import type { EnvFilesController } from "@/state/useEnvFiles.ts";
import type { EnvEditor } from "@/state/useEnvEditor.ts";
import { useShortcuts } from "@/state/useShortcuts.ts";
import { ConfirmDialog } from "@/components/ui/index.ts";
import { EmptyEnvFiles } from "@/components/common/EmptyState.tsx";
import { ErrorBar } from "@/components/common/ErrorBar.tsx";
import { UndoToast } from "@/components/common/UndoToast.tsx";
import { NewEnvFileDialog } from "@/components/envfiles/NewEnvFileDialog.tsx";
import { ConflictDialog } from "@/components/editor/ConflictDialog.tsx";
import { EditorToolbar } from "@/components/editor/EditorToolbar.tsx";
import type { EditorMode } from "@/components/editor/EditorToolbar.tsx";
import { GitWarningBanner } from "@/components/editor/GitWarningBanner.tsx";
import { RawEditor } from "@/components/editor/RawEditor.tsx";
import { StatusBar } from "@/components/editor/StatusBar.tsx";
import { VariablesEditor } from "@/components/editor/VariablesEditor.tsx";

import { ProjectHeader } from "./ProjectHeader.tsx";

export interface WorkspaceProps {
  readonly project: Project;
  readonly homeDirectory: string | null;
  readonly envFiles: EnvFilesController;
  readonly editor: EnvEditor;
  readonly gitState: GitIgnoreState | null;
  readonly activeFile: string | null;
  readonly onSelectFile: (name: string) => void;
  /** Set while a project-level dialog owns the keyboard. */
  readonly shortcutsBlocked: boolean;
}

interface UndoEntry {
  readonly message: string;
  readonly text: string;
}

/** Everything inside the main content area for one project. */
export function Workspace({
  project,
  homeDirectory,
  envFiles,
  editor,
  gitState,
  activeFile,
  onSelectFile,
  shortcutsBlocked,
}: WorkspaceProps) {
  const [mode, setMode] = useState<EditorMode>("variables");
  const [search, setSearch] = useState("");
  // Keyed by variable name; see VariablesEditor for why not by node id.
  const [revealedKeys, setRevealedKeys] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [revealAll, setRevealAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [deleteFileOpen, setDeleteFileOpen] = useState(false);
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Revealing is never carried from one file to the next.
  useEffect(() => {
    setRevealedKeys(new Set<string>());
    setRevealAll(false);
    setAdding(false);
    setSearch("");
    setUndo(null);
  }, [activeFile, project.id]);

  const dialogOpen =
    newFileOpen || deleteFileOpen || editor.hasConflict || shortcutsBlocked;

  useShortcuts({
    enabled: !dialogOpen && activeFile !== null,
    onSave: () => void editor.save(),
    onFocusSearch: () => {
      setMode("variables");
      searchRef.current?.focus();
    },
    onAddVariable: () => {
      setMode("variables");
      setAdding(true);
    },
  });

  const toggleReveal = (key: string) => {
    setRevealedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const deleteVariable = (key: string, id: string) => {
    const previousText = editor.text;
    editor.applyEdit((current) => removeNode(current, id));
    setUndo({ message: `Removed ${key}`, text: previousText });
  };

  const deleteActiveFile = () => {
    if (activeFile === null) {
      return;
    }
    void envFiles.trash(activeFile);
  };

  if (envFiles.files.length === 0 && envFiles.loaded) {
    return (
      <>
        <ProjectHeader
          project={project}
          homeDirectory={homeDirectory}
          files={envFiles.files}
          activeFile={activeFile}
          dirtyFiles={editor.dirtyFileNames}
          onSelectFile={onSelectFile}
          onCreateFile={() => setNewFileOpen(true)}
          onReveal={() => fireAndForget(revealProject(project.id))}
        />
        {envFiles.error !== null && (
          <ErrorBar message={envFiles.error} onDismiss={() => void envFiles.refresh()} />
        )}
        <div className="flex-1">
          <EmptyEnvFiles
            projectName={project.name}
            onCreate={() => setNewFileOpen(true)}
          />
        </div>
        <NewEnvFileDialog
          open={newFileOpen}
          onOpenChange={setNewFileOpen}
          existingNames={envFiles.files.map((file) => file.name)}
          onCreate={(fileName) => {
            void envFiles.create(fileName).then((created) => {
              if (created) {
                onSelectFile(fileName);
              }
            });
          }}
        />
      </>
    );
  }

  const activeInfo = envFiles.files.find((file) => file.name === activeFile);

  return (
    <>
      <ProjectHeader
        project={project}
        homeDirectory={homeDirectory}
        files={envFiles.files}
        activeFile={activeFile}
        dirtyFiles={editor.dirtyFileNames}
        onSelectFile={onSelectFile}
        onCreateFile={() => setNewFileOpen(true)}
        onReveal={() => fireAndForget(revealProject(project.id))}
      />

      <EditorToolbar
        mode={mode}
        onModeChange={setMode}
        search={search}
        onSearchChange={setSearch}
        searchRef={searchRef}
        revealAll={revealAll}
        onToggleRevealAll={() => setRevealAll((value) => !value)}
        isDirty={editor.isDirty}
        saving={editor.saving}
        onSave={() => void editor.save()}
        onRevealFile={() => {
          if (activeFile !== null) {
            fireAndForget(revealEnvFile(project.id, activeFile));
          }
        }}
        onDeleteFile={() => setDeleteFileOpen(true)}
      />

      {envFiles.error !== null && (
        <ErrorBar
          message={envFiles.error}
          onDismiss={() => void envFiles.refresh()}
        />
      )}
      {editor.error !== null && (
        <ErrorBar message={editor.error} onDismiss={editor.dismissError} />
      )}
      {activeFile !== null && (
        <GitWarningBanner state={gitState} fileName={activeFile} />
      )}

      <div className="scroll-thin min-h-0 flex-1 overflow-auto bg-surface">
        {editor.status === "loading" && (
          <p className="px-4 py-6 text-[12.5px] text-ink-subtle">Loading…</p>
        )}
        {editor.status === "ready" &&
          (mode === "variables" ? (
            <VariablesEditor
              document={editor.document}
              search={search}
              revealedKeys={revealedKeys}
              revealAll={revealAll}
              adding={adding}
              onToggleReveal={toggleReveal}
              onApplyEdit={editor.applyEdit}
              onRequestDelete={deleteVariable}
              onStartAdding={() => setAdding(true)}
              onStopAdding={() => setAdding(false)}
            />
          ) : (
            <RawEditor
              text={editor.text}
              revealed={revealAll}
              onChange={editor.setText}
            />
          ))}
      </div>

      <StatusBar
        gitState={gitState}
        variableCount={countVariables(editor.document)}
        sizeBytes={activeInfo?.sizeBytes ?? 0}
        isDirty={editor.isDirty}
      />

      {undo !== null && (
        <UndoToast
          message={undo.message}
          onUndo={() => {
            editor.setText(undo.text);
            setUndo(null);
          }}
          onDismiss={() => setUndo(null)}
        />
      )}

      <NewEnvFileDialog
        open={newFileOpen}
        onOpenChange={setNewFileOpen}
        existingNames={envFiles.files.map((file) => file.name)}
        onCreate={(fileName) => {
          void envFiles.create(fileName).then((created) => {
            if (created) {
              onSelectFile(fileName);
            }
          });
        }}
      />

      <ConfirmDialog
        open={deleteFileOpen}
        onOpenChange={setDeleteFileOpen}
        tone="danger"
        title={`Move ${activeFile ?? "this file"} to the Trash?`}
        description={
          <>
            The file is moved to the Trash, not deleted permanently, so you can
            restore it from Finder. Nothing else in{" "}
            <span className="font-medium text-ink">{project.name}</span> is
            touched.
          </>
        }
        confirmLabel="Move to Trash"
        onConfirm={deleteActiveFile}
      />

      <ConflictDialog
        open={editor.hasConflict}
        fileName={activeFile ?? ""}
        onReload={() => void editor.reload()}
        onReview={editor.dismissConflict}
        onOverwrite={() => void editor.forceSave()}
      />
    </>
  );
}
