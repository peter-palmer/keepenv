/**
 * Folders opened from the terminal.
 *
 * `keepenv .` resolves the folder in Rust and hands it over as an already
 * registered project, so nothing here constructs or validates a path.
 */

import { listen } from "@tauri-apps/api/event";

import { call } from "./ipc.ts";
import type { Project } from "./types.ts";
import type { Unsubscribe } from "./window.service.ts";

const LAUNCH_TARGET_EVENT = "keepenv://launch-target";

/**
 * Consumes the folder Keepenv was started with, if any.
 *
 * Only meaningful once per launch: the pending target is drained, so a reload
 * of the interface will not reopen it.
 */
export function takeLaunchTarget(): Promise<Project | null> {
  return call<Project | null>("take_launch_target");
}

/** Fires when `keepenv <folder>` runs while the app is already open. */
export function onLaunchTarget(
  handler: (project: Project) => void,
): Promise<Unsubscribe> {
  return listen<Project>(LAUNCH_TARGET_EVENT, (event) => handler(event.payload));
}
