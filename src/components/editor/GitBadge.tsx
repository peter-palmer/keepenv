import { GitBranch, ShieldAlert, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/cn.ts";
import type { GitIgnoreState } from "@/services/index.ts";

export interface GitBadgeProps {
  readonly state: GitIgnoreState | null;
}

interface Presentation {
  readonly label: string;
  readonly title: string;
  readonly className: string;
  readonly icon: React.ReactNode;
}

function presentationFor(state: GitIgnoreState): Presentation | null {
  switch (state) {
    case "ignored":
      return {
        label: "Git ignored",
        title: "This file matches a .gitignore rule and will not be committed.",
        className: "text-ok",
        icon: <ShieldCheck size={13} />,
      };
    case "tracked":
      return {
        label: "Tracked by Git",
        title:
          "This file is committed to the repository. Its contents are already in Git history.",
        className: "text-danger",
        icon: <ShieldAlert size={13} />,
      };
    case "notIgnored":
      return {
        label: "Not ignored",
        title:
          "Nothing in .gitignore covers this file, so it can be committed by accident.",
        className: "text-warn",
        icon: <ShieldAlert size={13} />,
      };
    case "noRepository":
      return {
        label: "No Git repository",
        title: "This project folder is not inside a Git working tree.",
        className: "text-ink-subtle",
        icon: <GitBranch size={13} />,
      };
    case "gitUnavailable":
      return null;
  }
}

/** A read-only indicator. Keepenv never modifies .gitignore or commits. */
export function GitBadge({ state }: GitBadgeProps) {
  if (state === null) {
    return null;
  }
  const presentation = presentationFor(state);
  if (presentation === null) {
    return null;
  }

  return (
    <span
      title={presentation.title}
      className={cn(
        "inline-flex items-center gap-1.5 text-[11.5px]",
        presentation.className,
      )}
    >
      {presentation.icon}
      {presentation.label}
    </span>
  );
}
