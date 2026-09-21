import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn.ts";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ children }: { readonly children: ReactNode }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="start"
        sideOffset={4}
        className={cn(
          "z-50 min-w-[190px] rounded-lg border border-hairline bg-panel p-1",
          "shadow-xl focus:outline-none",
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export interface MenuItemProps {
  readonly children: ReactNode;
  readonly onSelect: () => void;
  readonly tone?: "neutral" | "danger";
}

export function MenuItem({ children, onSelect, tone = "neutral" }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
        "outline-none select-none",
        tone === "danger"
          ? "text-danger data-highlighted:bg-danger-soft"
          : "text-ink data-highlighted:bg-accent data-highlighted:text-accent-ink",
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-hairline" />;
}
