/**
 * UI preferences.
 *
 * `Preferences` is a closed shape of display settings — there is no way to
 * persist environment data through this service.
 */

import { call } from "./ipc.ts";
import type { Preferences } from "./types.ts";

export function getPreferences(): Promise<Preferences> {
  return call<Preferences>("get_preferences");
}

export function setPreferences(
  preferences: Preferences,
): Promise<Preferences> {
  return call<Preferences>("set_preferences", { preferences });
}
