import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fireAndForget } from "@/lib/async.ts";
import { copyText } from "@/lib/clipboard.ts";
import {
  closeWindow,
  onCloseRequested,
  readHomeDirectory,
  revealProject,
} from "@/services/index.ts";
import type { Project } from "@/services/index.ts";
import { useEnvEditor } from "@/state/useEnvEditor.ts";
import { useEnvFiles } from "@/state/useEnvFiles.ts";
import { useGitStatus } from "@/state/useGitStatus.ts";
import { useLaunchTarget } from "@/state/useLaunchTarget.ts";
import { usePreferences } from "@/state/usePreferences.ts";
import { useProjects } from "@/state/useProjects.ts";
import { useTheme } from "@/state/useTheme.ts";
import { ConfirmDialog } from "@/components/ui/index.ts";
import { EmptyProjects } from "@/components/common/EmptyState.tsx";
import { ErrorBar } from "@/components/common/ErrorBar.tsx";
import { Sidebar } from "@/components/projects/Sidebar.tsx";
import { Workspace } from "@/components/layout/Workspace.tsx";

/**
 * The composition root.
 *
 * Holds the selection (which project, which file) and the editor state, so
 * unsaved drafts survive switching between projects. All filesystem work
 * happens behind `@/services`.
 */
export function App() {
  const projectsController = useProjects();
  const { preferences, loaded: preferencesLoaded, update } = usePreferences();
  useTheme(preferences.theme);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [homeDirectory, setHomeDirectory] = useState<string | null>(null);
  const [projectToRemove, setProjectToRemove] = useState<Project | null>(null);
  const [quitPrompt, setQuitPrompt] = useState(false);

  const { projects, loaded: projectsLoaded } = projectsController;
  const envFiles = useEnvFiles(activeProjectId);
  const editor = useEnvEditor(activeProjectId, activeFile);
  const gitState = useGitStatus(activeProjectId, activeFile, editor.revision);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  useEffect(() => {
    void readHomeDirectory()
      .then(setHomeDirectory)
      .catch(() => setHomeDirectory(null));
  }, []);

  // Restore the last project once both the list and preferences are loaded.
  useEffect(() => {
    if (!projectsLoaded || !preferencesLoaded || activeProjectId !== null) {
      return;
    }
    const remembered = projects.find(
      (project) => project.id === preferences.lastProjectId,
    );
    const fallback = projects[0];
    const next = remembered ?? fallback;
    if (next !== undefined) {
      setActiveProjectId(next.id);
    }
  }, [
    projectsLoaded,
    preferencesLoaded,
    activeProjectId,
    projects,
    preferences.lastProjectId,
  ]);

  useEffect(() => {
    if (activeProjectId !== null) {
      update({ lastProjectId: activeProjectId });
    }
  }, [activeProjectId, update]);

  // Keep the file selection valid as the file list changes.
  useEffect(() => {
    if (!envFiles.loaded) {
      return;
    }
    const names = envFiles.files.map((file) => file.name);
    if (activeFile !== null && names.includes(activeFile)) {
      return;
    }
    setActiveFile(names[0] ?? null);
  }, [envFiles.loaded, envFiles.files, activeFile]);

  // Read inside the close listener, which outlives any single render.
  const hasUnsavedWork = useRef(editor.hasUnsavedWork);
  hasUnsavedWork.current = editor.hasUnsavedWork;

  // Never quit with unsaved edits without asking.
  useEffect(() => {
    let dispose: (() => void) | null = null;
    onCloseRequested(() => {
      if (hasUnsavedWork.current) {
        setQuitPrompt(true);
        return false;
      }
      return true;
    })
      .then((unsubscribe) => {
        dispose = unsubscribe;
      })
      .catch(() => {
        // Without the guard a quit simply proceeds, as it would by default.
      });
    return () => dispose?.();
  }, []);

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setActiveFile(null);
  }, []);

  // `keepenv .` from a terminal. Rust has already validated the folder and
  // registered it, so this only has to refresh the sidebar and select it.
  const openLaunchTarget = useCallback(
    (project: Project) => {
      void projectsController.refresh().then(() => {
        selectProject(project.id);
      });
    },
    [projectsController, selectProject],
  );

  useLaunchTarget(openLaunchTarget);

  const addProject = useCallback(() => {
    void projectsController.addFromPicker().then((project) => {
      if (project !== null) {
        selectProject(project.id);
      }
    });
  }, [projectsController, selectProject]);

  const confirmRemoveProject = useCallback(() => {
    if (projectToRemove === null) {
      return;
    }
    const removedId = projectToRemove.id;
    void projectsController.remove(removedId).then(() => {
      if (activeProjectId === removedId) {
        setActiveProjectId(null);
        setActiveFile(null);
      }
    });
  }, [projectToRemove, projectsController, activeProjectId]);

  return (
    <div className="flex h-full">
      {/* A drag strip across the top so the window moves from anywhere. */}
      <div
        data-tauri-drag-region
        className="fixed inset-x-0 top-0 z-30 h-[38px]"
      />

      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={selectProject}
        onAdd={addProject}
        onRename={(id, name) => void projectsController.rename(id, name)}
        onReveal={(id) => fireAndForget(revealProject(id))}
        onCopyPath={(project) => fireAndForget(copyText(project.rootPath))}
        onRemove={setProjectToRemove}
        onReorder={(ids) => void projectsController.reorder(ids)}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-surface">
        {projectsController.error !== null && (
          <ErrorBar
            message={projectsController.error}
            onDismiss={projectsController.dismissError}
          />
        )}

        {activeProject === null ? (
          <div className="flex-1">
            {projectsLoaded && <EmptyProjects onAdd={addProject} />}
          </div>
        ) : (
          <Workspace
            key={activeProject.id}
            project={activeProject}
            homeDirectory={homeDirectory}
            envFiles={envFiles}
            editor={editor}
            gitState={gitState}
            activeFile={activeFile}
            onSelectFile={setActiveFile}
            shortcutsBlocked={projectToRemove !== null || quitPrompt}
          />
        )}
      </main>

      <ConfirmDialog
        open={projectToRemove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProjectToRemove(null);
          }
        }}
        tone="danger"
        title={`Remove ${projectToRemove?.name ?? "project"} from Keepenv?`}
        description={
          <>
            Keepenv forgets this folder and its environment files disappear from
            the sidebar.{" "}
            <span className="font-medium text-ink">
              Nothing on disk is deleted
            </span>{" "}
            — the project folder and every file in it stay exactly where they
            are.
          </>
        }
        confirmLabel="Remove from Keepenv"
        onConfirm={confirmRemoveProject}
      />

      <ConfirmDialog
        open={quitPrompt}
        onOpenChange={setQuitPrompt}
        tone="danger"
        title="Quit with unsaved changes?"
        description="Some environment files have edits that have not been written to disk. Quitting now discards them."
        confirmLabel="Discard and quit"
        cancelLabel="Keep editing"
        onConfirm={() => fireAndForget(closeWindow())}
      />
    </div>
  );
}
