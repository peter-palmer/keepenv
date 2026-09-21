/**
 * Display formatting helpers. None of these ever receive a secret value.
 */

/** Replaces the user's home directory with `~`. */
export function shortenPath(path: string, home: string | null): string {
  if (home !== null && home.length > 0 && path.startsWith(home)) {
    return `~${path.slice(home.length)}`;
  }
  return path;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A mask of fixed width, so the dots never hint at a value's length. */
export const MASK = "••••••••••••";
