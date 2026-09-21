/**
 * Input validation for file names and variable keys.
 *
 * These rules mirror `src-tauri/src/paths.rs` so the UI can give immediate
 * feedback. Rust re-validates every value it receives — this module is a
 * convenience, never the enforcement point.
 */

const MAX_FILE_NAME_LENGTH = 100;

export const ENV_FILE_NAME_HINT =
  "Start with .env, for example .env.staging or .env.local";

/** Returns an error message, or `null` when the name is acceptable. */
export function validateEnvFileName(
  name: string,
  existingNames: readonly string[] = [],
): string | null {
  if (name.length === 0) {
    return "Enter a file name.";
  }
  if (name.length > MAX_FILE_NAME_LENGTH) {
    return "That name is too long.";
  }
  if (/[/\\]/.test(name)) {
    return "A file name cannot contain a path.";
  }
  if (name.includes("..")) {
    return "A file name cannot contain “..”.";
  }
  if (!name.startsWith(".env")) {
    return "The name must start with .env";
  }

  const rest = name.slice(".env".length);
  if (rest.length > 0 && !/^[.\-_][A-Za-z0-9][A-Za-z0-9._-]*$/.test(rest)) {
    return "Use letters, numbers, dots, dashes or underscores after .env";
  }
  if (existingNames.includes(name)) {
    return "That file already exists in this project.";
  }
  return null;
}

/** Returns an error message, or `null` when the key is acceptable. */
export function validateVariableKey(key: string): string | null {
  if (key.length === 0) {
    return "Enter a variable name.";
  }
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key)) {
    return "Start with a letter or underscore, then letters, numbers, _ . or -";
  }
  return null;
}
