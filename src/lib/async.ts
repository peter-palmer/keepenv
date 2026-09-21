/**
 * Helpers for promises whose failure has no useful UI.
 */

/**
 * Runs a promise for its side effect and swallows a rejection.
 *
 * Used for actions where a failure needs no message — revealing a file in
 * Finder, copying to the clipboard — so a rejected promise never becomes an
 * unhandled error. Anything the user must know about is surfaced through the
 * owning hook's `error` instead.
 */
export function fireAndForget(operation: Promise<unknown>): void {
  void operation.catch(() => {});
}
