/**
 * Environment file operations.
 *
 * Every call names a project by id and a file by name; absolute paths are
 * never constructed on this side of the boundary.
 */

import { call } from "./ipc.ts";
import type {
  EnvFileContents,
  EnvFileInfo,
  EnvFileWriteResult,
} from "./types.ts";

export function listEnvFiles(projectId: string): Promise<EnvFileInfo[]> {
  return call<EnvFileInfo[]>("list_env_files", { projectId });
}

export function readEnvFile(
  projectId: string,
  fileName: string,
): Promise<EnvFileContents> {
  return call<EnvFileContents>("read_env_file", { projectId, fileName });
}

/**
 * Writes a file, refusing when it changed on disk since it was loaded.
 *
 * Pass `expectedDigest: null` only from an explicit "overwrite anyway" choice.
 */
export function writeEnvFile(
  projectId: string,
  fileName: string,
  content: string,
  expectedDigest: string | null,
): Promise<EnvFileWriteResult> {
  return call<EnvFileWriteResult>("write_env_file", {
    projectId,
    fileName,
    content,
    expectedDigest,
  });
}

export function createEnvFile(
  projectId: string,
  fileName: string,
): Promise<void> {
  return call<void>("create_env_file", { projectId, fileName });
}

/** Moves a file to the Trash. Never deletes permanently. */
export function trashEnvFile(
  projectId: string,
  fileName: string,
): Promise<void> {
  return call<void>("trash_env_file", { projectId, fileName });
}
