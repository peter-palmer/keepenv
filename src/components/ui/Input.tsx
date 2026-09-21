import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn.ts";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly invalid?: boolean;
}

export function Input({ className, invalid = false, ...props }: InputProps) {
  return (
    <input
      // Environment values must never reach a spellchecker or an autofill store.
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      data-1p-ignore
      className={cn(
        "h-8 w-full rounded-lg border bg-surface px-2.5 text-[13px] text-ink",
        "placeholder:text-ink-subtle transition-colors",
        "focus:outline-none focus-visible:border-accent",
        invalid ? "border-danger" : "border-hairline",
        className,
      )}
      {...props}
    />
  );
}
