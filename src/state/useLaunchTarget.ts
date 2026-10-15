import { useEffect, useRef, useState } from "react";

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
 *
 * Returns `true` once the cold-start target has been resolved, whether or not
 * there was one. Restoring the previously open project must wait for that:
 * otherwise both run and whichever lands last wins, which made `keepenv .`
 * silently reopen the last project instead of the requested folder.
 */
export function useLaunchTarget(onOpen: (project: Project) => void): boolean {
  const handler = useRef(onOpen);
  handler.current = onOpen;
  const [checked, setChecked] = useState(false);

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
      })
      .finally(() => {
        if (active) {
          setChecked(true);
        }
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

  return checked;
}
