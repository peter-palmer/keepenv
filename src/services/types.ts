/**
 * The IPC contract, mirroring `src-tauri/src/model.rs`.
 *
 * Note what is *not* here: no type carries an environment value into anything
 * Keepenv stores. `Project` and `Preferences` — the only persisted shapes —
 * hold identifiers, a path and display settings.
 */

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly rootPath: string;
  readonly addedAt: string;
  readonly order: number;
}

export type ThemePreference = "system" | "light" | "dark";

export interface Preferences {
  readonly theme: ThemePreference;
  readonly lastProjectId: string | null;
}

export interface EnvFileInfo {
  readonly name: string;
  readonly sizeBytes: number;
  readonly modifiedAtMs: number | null;
  readonly isSymlink: boolean;
}

export interface EnvFileContents {
  readonly name: string;
  readonly content: string;
  /** Fingerprint of the bytes on disk, used to detect external edits. */
  readonly digest: string;
  readonly sizeBytes: number;
  readonly modifiedAtMs: number | null;
}

export interface EnvFileWriteResult {
  readonly digest: string;
  readonly sizeBytes: number;
  readonly modifiedAtMs: number | null;
}

export type GitIgnoreState =
  | "noRepository"
  | "gitUnavailable"
  | "ignored"
  | "tracked"
  | "notIgnored";

export interface GitStatus {
  readonly state: GitIgnoreState;
}
