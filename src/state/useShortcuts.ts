import { useEffect } from "react";

export interface ShortcutHandlers {
  readonly onSave: () => void;
  readonly onFocusSearch: () => void;
  readonly onAddVariable: () => void;
  /** Disabled while a modal owns the keyboard. */
  readonly enabled: boolean;
}

/**
 * Application keyboard shortcuts.
 *
 * `metaKey || ctrlKey` so the same bindings work if Keepenv is ever built for
 * Windows or Linux.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const { onSave, onFocusSearch, onAddVariable, enabled } = handlers;

  useEffect(() => {
    if (!enabled) {
      return () => {};
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      switch (event.key.toLowerCase()) {
        case "s":
          event.preventDefault();
          onSave();
          break;
        case "f":
          event.preventDefault();
          onFocusSearch();
          break;
        case "n":
          event.preventDefault();
          onAddVariable();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onSave, onFocusSearch, onAddVariable]);
}
