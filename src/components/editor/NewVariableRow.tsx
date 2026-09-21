import { useEffect, useRef, useState } from "react";

import { validateVariableKey } from "@/lib/env/index.ts";
import { Button } from "@/components/ui/index.ts";

export interface NewVariableRowProps {
  readonly existingKeys: readonly string[];
  readonly onCommit: (key: string, value: string) => void;
  readonly onCancel: () => void;
}

const FIELD_CLASS =
  "w-full rounded-md border border-hairline bg-surface px-2 py-1 " +
  "font-mono text-[12.5px] text-ink focus:border-accent focus:outline-none";

/** The inline draft row shown by “Add variable”. */
export function NewVariableRow({
  existingKeys,
  onCommit,
  onCancel,
}: NewVariableRowProps) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    keyRef.current?.focus();
  }, []);

  const error = validateVariableKey(key);
  const duplicate = error === null && existingKeys.includes(key);
  const canCommit = error === null;

  const commit = () => {
    if (canCommit) {
      onCommit(key, value);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="grid grid-cols-[minmax(150px,240px)_1fr_auto] items-start gap-2 border-b border-hairline bg-accent-soft/40 px-4 py-2">
      <div>
        <input
          ref={keyRef}
          value={key}
          placeholder="VARIABLE_NAME"
          spellCheck={false}
          autoComplete="off"
          data-1p-ignore
          aria-label="New variable name"
          onChange={(event) => setKey(event.target.value)}
          onKeyDown={onKeyDown}
          className={FIELD_CLASS}
        />
        {key !== "" && error !== null && (
          <p className="px-1 pt-1 text-[11px] text-danger">{error}</p>
        )}
        {duplicate && (
          <p className="px-1 pt-1 text-[11px] text-warn">
            This name already exists and will override the earlier one.
          </p>
        )}
      </div>

      <input
        value={value}
        placeholder="value"
        spellCheck={false}
        autoComplete="off"
        data-1p-ignore
        aria-label="New variable value"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        className={FIELD_CLASS}
      />

      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!canCommit}
          onClick={commit}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
