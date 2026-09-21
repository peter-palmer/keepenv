/**
 * Clipboard access.
 *
 * Copying a secret is routed through [`copySecret`] rather than calling the
 * clipboard directly, so an automatic-clear policy can be turned on later in
 * exactly one place. The timer infrastructure is in place and disabled by
 * default — clearing the clipboard behind the user's back would be surprising
 * without a preference to control it.
 *
 * Nothing here logs the value being copied.
 */

/**
 * How long a copied secret may stay on the clipboard, in milliseconds.
 * `null` disables automatic clearing. Wire this to a preference to enable it.
 */
const SECRET_CLIPBOARD_LIFETIME_MS: number | null = null;

let clearTimer: ReturnType<typeof setTimeout> | null = null;

async function writeToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for webviews without the async clipboard API.
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(field);
  }
}

/** Cancels a pending automatic clear, if one is scheduled. */
export function cancelScheduledClipboardClear(): void {
  if (clearTimer !== null) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
}

/** Copies non-sensitive text, such as a project path. */
export async function copyText(text: string): Promise<void> {
  cancelScheduledClipboardClear();
  await writeToClipboard(text);
}

/**
 * Copies a secret value, scheduling a clear when a lifetime is configured.
 *
 * The clear only fires if the clipboard still holds the copied value, so it
 * cannot wipe something the user copied afterwards.
 */
export async function copySecret(value: string): Promise<void> {
  cancelScheduledClipboardClear();
  await writeToClipboard(value);

  if (SECRET_CLIPBOARD_LIFETIME_MS === null) {
    return;
  }

  clearTimer = setTimeout(() => {
    clearTimer = null;
    void (async () => {
      try {
        const current = await navigator.clipboard?.readText();
        if (current === value) {
          await writeToClipboard("");
        }
      } catch {
        // Reading the clipboard may be unavailable; leave it untouched.
      }
    })();
  }, SECRET_CLIPBOARD_LIFETIME_MS);
}
