import { Check, Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn.ts";
import { fireAndForget } from "@/lib/async.ts";
import { copySecret } from "@/lib/clipboard.ts";
import { MASK } from "@/lib/format.ts";
import { validateVariableKey } from "@/lib/env/index.ts";
import type { VariableEntry } from "@/lib/env/index.ts";

export interface VariableRowProps {
  readonly entry: VariableEntry;
  readonly revealed: boolean;
  readonly onToggleReveal: () => void;
  readonly onKeyChange: (key: string) => void;
  readonly onValueChange: (value: string) => void;
  readonly onDelete: () => void;
}

const FIELD_CLASS =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1 " +
  "font-mono text-[12.5px] text-ink transition-colors " +
  "hover:border-hairline focus:border-accent focus:bg-surface focus:outline-none";

/** Grows a textarea to fit a multi-line value. */
function useAutoSize(value: string, enabled: boolean) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (node === null || !enabled) {
      return;
    }
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value, enabled]);
  return ref;
}

export function VariableRow({
  entry,
  revealed,
  onToggleReveal,
  onKeyChange,
  onValueChange,
  onDelete,
}: VariableRowProps) {
  const { node, isShadowed, inlineComment } = entry;
  const [copied, setCopied] = useState(false);
  const isMultiline = node.value.includes("\n");
  const textareaRef = useAutoSize(node.value, revealed && isMultiline);
  const keyError = validateVariableKey(node.key);

  useEffect(() => {
    if (!copied) {
      return () => {};
    }
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    fireAndForget(copySecret(node.value).then(() => setCopied(true)));
  };

  return (
    <div
      className={cn(
        "group grid items-start gap-2 border-b border-hairline px-4 py-1.5",
        "grid-cols-[minmax(150px,240px)_1fr_auto] hover:bg-row",
      )}
    >
      <div className="pt-px">
        <input
          value={node.key}
          spellCheck={false}
          autoComplete="off"
          data-1p-ignore
          aria-label="Variable name"
          onChange={(event) => onKeyChange(event.target.value)}
          className={cn(
            FIELD_CLASS,
            "font-medium",
            keyError !== null && "border-danger/60 text-danger",
          )}
        />
        {isShadowed && (
          <p className="px-2 pt-0.5 text-[11px] text-warn">
            Overridden by a later line
          </p>
        )}
      </div>

      <div className="min-w-0 pt-px">
        {revealed ? (
          isMultiline ? (
            <textarea
              ref={textareaRef}
              value={node.value}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              data-1p-ignore
              aria-label="Variable value"
              rows={1}
              onChange={(event) => onValueChange(event.target.value)}
              className={cn(FIELD_CLASS, "resize-none leading-relaxed")}
            />
          ) : (
            <input
              value={node.value}
              spellCheck={false}
              autoComplete="off"
              data-1p-ignore
              aria-label="Variable value"
              onChange={(event) => onValueChange(event.target.value)}
              className={FIELD_CLASS}
            />
          )
        ) : (
          <button
            type="button"
            onClick={onToggleReveal}
            aria-label="Reveal value"
            className={cn(
              FIELD_CLASS,
              "flex h-[26px] items-center text-left tracking-[0.18em] text-ink-subtle",
            )}
          >
            {node.value === "" ? (
              <span className="tracking-normal text-[12px] italic">empty</span>
            ) : (
              MASK
            )}
          </button>
        )}
        {inlineComment !== "" && (
          <p className="truncate px-2 pt-0.5 font-mono text-[11px] text-ink-subtle">
            {inlineComment}
          </p>
        )}
      </div>

      <div className="flex items-center gap-0.5 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <IconAction
          label={revealed ? "Hide value" : "Reveal value"}
          onClick={onToggleReveal}
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </IconAction>
        <IconAction label="Copy value" onClick={copy}>
          {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
        </IconAction>
        <IconAction label="Delete variable" onClick={onDelete} tone="danger">
          <Trash2 size={14} />
        </IconAction>
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  tone = "neutral",
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly tone?: "neutral" | "danger";
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        tone === "danger"
          ? "text-ink-subtle hover:bg-danger-soft hover:text-danger"
          : "text-ink-subtle hover:bg-hairline hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
