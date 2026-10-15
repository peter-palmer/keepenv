import { useCallback, useEffect, useState } from "react";

import {
  addProject,
  listProjects,
  pickProjectFolder,
  removeProject,
  renameProject,
  reorderProjects,
} from "@/services/index.ts";
import type { Project } from "@/services/index.ts";

export interface ProjectsController {
  readonly projects: Project[];
  readonly loaded: boolean;
  readonly error: string | null;
  readonly dismissError: () => void;
  /** Re-reads the project list, e.g. after `keepenv .` registered one. */
  readonly refresh: () => Promise<void>;
  /** Opens the folder picker; resolves to the project, or `null` if cancelled. */
  readonly addFromPicker: () => Promise<Project | null>;
  readonly rename: (id: string, name: string) => Promise<void>;
  /** Forgets a project. Never deletes anything from disk. */
  readonly remove: (id: string) => Promise<void>;
  readonly reorder: (ids: readonly string[]) => Promise<void>;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Something went wrong.";
}

export function useProjects(): ProjectsController {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listProjects()
      .then((stored) => {
        if (active) {
          setProjects(stored);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(messageOf(cause));
        }
      })
      .finally(() => {
        if (active) {
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, []);

  const addFromPicker = useCallback(async (): Promise<Project | null> => {
    try {
      const folder = await pickProjectFolder();
      if (folder === null) {
        return null;
      }
      const project = await addProject(folder);
      setProjects(await listProjects());
      return project;
    } catch (cause) {
      setError(messageOf(cause));
      return null;
    }
  }, []);

  const rename = useCallback(async (id: string, name: string) => {
    try {
      await renameProject(id, name);
      setProjects(await listProjects());
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await removeProject(id);
      setProjects(await listProjects());
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, []);

  const reorder = useCallback(async (ids: readonly string[]) => {
    // Apply locally first so the drag feels instant, then confirm with Rust.
    setProjects((previous) => {
      const byId = new Map(previous.map((project) => [project.id, project]));
      const next: Project[] = [];
      for (const id of ids) {
        const project = byId.get(id);
        if (project !== undefined) {
          next.push(project);
          byId.delete(id);
        }
      }
      return [...next, ...byId.values()];
    });

    try {
      setProjects(await reorderProjects(ids));
    } catch (cause) {
      setError(messageOf(cause));
      setProjects(await listProjects().catch(() => []));
    }
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    projects,
    loaded,
    error,
    dismissError,
    refresh,
    addFromPicker,
    rename,
    remove,
    reorder,
  };
}
