/**
 * Finder integration and path lookups.
 */

import { call } from "./ipc.ts";

export function revealProject(projectId: string): Promise<void> {
  return call<void>("reveal_project", { projectId });
}

export function revealEnvFile(
  projectId: string,
  fileName: string,
): Promise<void> {
  return call<void>("reveal_env_file", { projectId, fileName });
}

export function readProjectPath(projectId: string): Promise<string> {
  return call<string>("project_path", { projectId });
}

/** The user's home directory, used only to abbreviate displayed paths. */
export function readHomeDirectory(): Promise<string | null> {
  return call<string | null>("home_directory");
}
