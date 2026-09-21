import { useEffect, useRef } from "react";

export interface RawEditorProps {
  readonly text: string;
  readonly revealed: boolean;
  readonly onChange: (text: string) => void;
}

/**
 * The raw text view.
 *
 * A plain textarea with monospace type — deliberately not a code editor
 * component, which would add a large dependency for very little benefit on
 * files of this size. Changes here are parsed back into the variables table
 * because both views read from the same text.
 */
export function RawEditor({ text, revealed, onChange }: RawEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (revealed) {
      ref.current?.focus();
    }
  }, [revealed]);

  if (!revealed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-[13px] font-medium text-ink">Values are hidden</p>
        <p className="max-w-sm text-[12px] leading-relaxed text-ink-muted">
          Raw mode shows the file exactly as it is on disk, including every
          secret. Turn on <span className="font-medium text-ink">Reveal all</span>{" "}
          to show it.
        </p>
      </div>
    );
  }

  return (
    <textarea
      ref={ref}
      value={text}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      data-1p-ignore
      aria-label="Raw environment file"
      onChange={(event) => onChange(event.target.value)}
      className="scroll-thin h-full w-full resize-none bg-surface px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-ink focus:outline-none"
    />
  );
}
