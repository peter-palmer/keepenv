/**
 * Project registry operations.
 */

import { open } from "@tauri-apps/plugin-dialog";

import { call } from "./ipc.ts";
import type { Project } from "./types.ts";

export function listProjects(): Promise<Project[]> {
  return call<Project[]>("list_projects");
}

export function addProject(rootPath: string): Promise<Project> {
  return call<Project>("add_project", { rootPath });
}

export function renameProject(id: string, name: string): Promise<Project> {
  return call<Project>("rename_project", { id, name });
}

/** Forgets a project. The folder on disk is never touched. */
export function removeProject(id: string): Promise<void> {
  return call<void>("remove_project", { id });
}

export function reorderProjects(ids: readonly string[]): Promise<Project[]> {
  return call<Project[]>("reorder_projects", { ids });
}

/** Opens the native folder picker. Resolves to `null` if the user cancels. */
export async function pickProjectFolder(): Promise<string | null> {
  const selection = await open({
    directory: true,
    multiple: false,
    title: "Select project folder",
  });
  return typeof selection === "string" ? selection : null;
}
