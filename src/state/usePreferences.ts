import { useCallback, useEffect, useState } from "react";

import { getPreferences, setPreferences } from "@/services/index.ts";
import type { Preferences } from "@/services/index.ts";

const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  lastProjectId: null,
};

export interface PreferencesController {
  readonly preferences: Preferences;
  readonly loaded: boolean;
  readonly update: (patch: Partial<Preferences>) => void;
}

/**
 * UI preferences, persisted through Rust.
 *
 * Writes are fire-and-forget: a failure to persist a display setting must
 * never interrupt editing.
 */
export function usePreferences(): PreferencesController {
  const [preferences, setLocal] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getPreferences()
      .then((stored) => {
        if (active) {
          setLocal(stored);
        }
      })
      .catch(() => {
        // Fall back to defaults; preferences are not essential.
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

  const update = useCallback((patch: Partial<Preferences>) => {
    setLocal((previous) => {
      const next = { ...previous, ...patch };
      void setPreferences(next).catch(() => {});
      return next;
    });
  }, []);

  return { preferences, loaded, update };
}
