import { useEffect, useState } from "react";

import type { ThemePreference } from "@/services/index.ts";

export type ResolvedTheme = "light" | "dark";

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Applies a theme preference to the document, following the system appearance
 * when the preference is `"system"`.
 */
export function useTheme(preference: ThemePreference): ResolvedTheme {
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      setSystem(event.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme = preference === "system" ? system : preference;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  return resolved;
}
