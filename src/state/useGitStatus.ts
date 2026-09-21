import { useEffect, useState } from "react";

import { readGitStatus } from "@/services/index.ts";
import type { GitIgnoreState } from "@/services/index.ts";

/**
 * Whether the selected environment file is exposed to Git.
 *
 * Re-checked whenever the file is saved or reloaded, because a `.gitignore`
 * change elsewhere can flip the answer.
 */
export function useGitStatus(
  projectId: string | null,
  fileName: string | null,
  revision: number,
): GitIgnoreState | null {
  const [state, setState] = useState<GitIgnoreState | null>(null);

  useEffect(() => {
    if (projectId === null || fileName === null) {
      setState(null);
      return () => {};
    }

    let active = true;
    setState(null);
    void readGitStatus(projectId, fileName)
      .then((status) => {
        if (active) {
          setState(status.state);
        }
      })
      .catch(() => {
        if (active) {
          setState("gitUnavailable");
        }
      });

    return () => {
      active = false;
    };
  }, [projectId, fileName, revision]);

  return state;
}
