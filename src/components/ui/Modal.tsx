import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn.ts";

export interface ModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: ReactNode;
  readonly children?: ReactNode;
  readonly footer: ReactNode;
  readonly tone?: "neutral" | "danger" | "warning";
  /** "wide" fits a three-action footer without wrapping. */
  readonly size?: "default" | "wide";
}

const TONE_RING: Record<NonNullable<ModalProps["tone"]>, string> = {
  neutral: "",
  danger: "border-danger/30",
  warning: "border-warn/30",
};

/**
 * A centred modal dialog.
 *
 * Radix handles the focus trap, escape handling and `aria` wiring, which is
 * the part that is easy to get subtly wrong by hand.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  tone = "neutral",
  size = "default",
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50",
            size === "wide"
              ? "w-[min(560px,calc(100vw-48px))]"
              : "w-[min(440px,calc(100vw-48px))]",
            "-translate-x-1/2 -translate-y-1/2 rounded-xl border border-hairline",
            "bg-panel p-5 shadow-2xl focus:outline-none",
            TONE_RING[tone],
          )}
        >
          <Dialog.Title className="text-[15px] font-semibold text-ink">
            {title}
          </Dialog.Title>
          {description !== undefined && (
            <Dialog.Description asChild>
              <div className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                {description}
              </div>
            </Dialog.Description>
          )}
          {children !== undefined && <div className="mt-4">{children}</div>}
          <div className="mt-5 flex justify-end gap-2">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
