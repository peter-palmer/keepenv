/**
 * Window lifecycle.
 *
 * Kept here so `@tauri-apps/*` stays confined to the services layer.
 */

import { getCurrentWindow } from "@tauri-apps/api/window";

export type Unsubscribe = () => void;

/**
 * Registers a handler for the window's close request.
 *
 * Returning `false` cancels the close, which is how Keepenv stops a quit that
 * would discard unsaved edits.
 */
export async function onCloseRequested(
  handler: () => boolean,
): Promise<Unsubscribe> {
  return getCurrentWindow().onCloseRequested((event) => {
    if (!handler()) {
      event.preventDefault();
    }
  });
}

/** Closes the window without asking again. */
export async function closeWindow(): Promise<void> {
  await getCurrentWindow().destroy();
}
