/**
 * Read-only Git status. Keepenv never writes to a repository.
 */

import { call } from "./ipc.ts";
import type { GitStatus } from "./types.ts";

export function readGitStatus(
  projectId: string,
  fileName: string,
): Promise<GitStatus> {
  return call<GitStatus>("git_status", { projectId, fileName });
}
