import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn.ts";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "warning";

export type ButtonSize = "sm" | "md" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink hover:brightness-110 active:brightness-95 shadow-sm",
  secondary:
    "bg-panel text-ink border border-hairline hover:bg-row active:brightness-95",
  ghost: "text-ink-muted hover:bg-row hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110 active:brightness-95",
  warning: "bg-warn-soft text-warn border border-warn/30 hover:brightness-105",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[12px] gap-1.5 rounded-md",
  md: "h-8 px-3 text-[13px] gap-2 rounded-lg",
  icon: "h-7 w-7 justify-center rounded-md",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center whitespace-nowrap font-medium select-none",
        "transition-[background-color,filter,opacity]",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
