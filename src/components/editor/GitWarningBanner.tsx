import { ShieldAlert } from "lucide-react";

import type { GitIgnoreState } from "@/services/index.ts";

export interface GitWarningBannerProps {
  readonly state: GitIgnoreState | null;
  readonly fileName: string;
}

/**
 * A subtle warning when a file that may hold secrets is exposed to Git.
 *
 * Keepenv only reports; it never edits `.gitignore` and never commits.
 */
export function GitWarningBanner({ state, fileName }: GitWarningBannerProps) {
  if (state !== "notIgnored" && state !== "tracked") {
    return null;
  }
  // Example and template files are meant to be committed.
  if (/(example|sample|template)/i.test(fileName)) {
    return null;
  }

  return (
    <div className="flex items-start gap-2 border-b border-warn/25 bg-warn-soft px-4 py-2 text-[12px] text-warn">
      <ShieldAlert size={14} className="mt-0.5 shrink-0" />
      <p className="leading-relaxed">
        {state === "tracked" ? (
          <>
            <span className="font-medium">{fileName} is tracked by Git.</span>{" "}
            Its contents are already in the repository history. Removing it from
            the index does not erase what was committed.
          </>
        ) : (
          <>
            <span className="font-medium">{fileName} is not ignored by Git.</span>{" "}
            Add it to <span className="font-mono">.gitignore</span> before you
            commit. Keepenv will not change that file for you.
          </>
        )}
      </p>
    </div>
  );
}
