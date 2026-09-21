/**
 * The single gateway between React and Rust.
 *
 * Nothing else in `src/` imports from `@tauri-apps/*`. Keeping the boundary in
 * one file means the filesystem surface can be audited by reading this
 * directory alone.
 *
 * # Security
 *
 * Command arguments routinely contain environment file contents. They are
 * never logged, never serialized into an error message and never attached to a
 * thrown error. If a command fails, only Rust's own message (which names files,
 * never contents) is surfaced.
 */

import { invoke } from "@tauri-apps/api/core";

export type KeepenvErrorKind =
  | "projectNotFound"
  | "invalidFileName"
  | "invalidProjectRoot"
  | "pathEscapesRoot"
  | "fileNotFound"
  | "fileAlreadyExists"
  | "conflict"
  | "notARegularFile"
  | "notUtf8"
  | "tooLarge"
  | "trashFailed"
  | "io"
  | "store"
  | "unknown";

export class KeepenvError extends Error {
  readonly kind: KeepenvErrorKind;

  constructor(kind: KeepenvErrorKind, message: string) {
    super(message);
    this.name = "KeepenvError";
    this.kind = kind;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Normalises whatever Rust threw into an `KeepenvError`. */
function toKeepenvError(cause: unknown): KeepenvError {
  if (cause instanceof KeepenvError) {
    return cause;
  }
  if (isRecord(cause)) {
    const kind = typeof cause["kind"] === "string" ? cause["kind"] : "unknown";
    const message =
      typeof cause["message"] === "string"
        ? cause["message"]
        : "Something went wrong.";
    return new KeepenvError(kind as KeepenvErrorKind, message);
  }
  if (typeof cause === "string") {
    return new KeepenvError("unknown", cause);
  }
  return new KeepenvError("unknown", "Something went wrong.");
}

/** Invokes a Rust command with typed arguments and normalised errors. */
export async function call<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (cause) {
    // Deliberately not logging `args`: they may contain secrets.
    throw toKeepenvError(cause);
  }
}
