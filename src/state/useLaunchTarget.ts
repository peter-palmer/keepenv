import { useEffect, useRef } from "react";

import { onLaunchTarget, takeLaunchTarget } from "@/services/index.ts";
import type { Project } from "@/services/index.ts";

/**
 * Opens the project Keepenv was launched with from the terminal.
 *
 * Two paths converge here. A cold start parses its arguments before the
 * interface exists, so the pending target is drained on mount. A warm start —
 * running `keepenv .` while the app is already open — arrives as an event.
 *
 * `onOpen` is held in a ref so a changing callback never re-subscribes.
 */
export function useLaunchTarget(onOpen: (project: Project) => void): void {
  const handler = useRef(onOpen);
  handler.current = onOpen;

  useEffect(() => {
    let active = true;
    let dispose: (() => void) | null = null;

    takeLaunchTarget()
      .then((project) => {
        if (active && project !== null) {
          handler.current(project);
        }
      })
      .catch(() => {
        // Opening normally is the common case; nothing to report.
      });

    onLaunchTarget((project) => handler.current(project))
      .then((unsubscribe) => {
        if (active) {
          dispose = unsubscribe;
        } else {
          unsubscribe();
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      dispose?.();
    };
  }, []);
}
