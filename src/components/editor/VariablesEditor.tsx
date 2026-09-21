import { KeyRound, Plus, SearchX } from "lucide-react";

import {
  addVariable,
  listVariables,
  setVariableKey,
  setVariableValue,
} from "@/lib/env/index.ts";
import type { EnvDocument } from "@/lib/env/index.ts";
import { Button } from "@/components/ui/index.ts";

import { NewVariableRow } from "./NewVariableRow.tsx";
import { VariableRow } from "./VariableRow.tsx";

export interface VariablesEditorProps {
  readonly document: EnvDocument;
  readonly search: string;
  /**
   * Variable *names* whose value is currently shown.
   *
   * Keyed by name rather than by node identity on purpose: node ids follow a
   * line's position, so after a variable is added or removed a stale id would
   * point at a different row and could expose a value the user never revealed.
   */
  readonly revealedKeys: ReadonlySet<string>;
  readonly revealAll: boolean;
  readonly adding: boolean;
  readonly onToggleReveal: (key: string) => void;
  readonly onApplyEdit: (edit: (document: EnvDocument) => EnvDocument) => void;
  readonly onRequestDelete: (key: string, id: string) => void;
  readonly onStartAdding: () => void;
  readonly onStopAdding: () => void;
}

/**
 * The structured variable table.
 *
 * Every mutation is expressed as a document transform, so the surrounding
 * comments and formatting of the file are never rewritten.
 */
export function VariablesEditor({
  document,
  search,
  revealedKeys,
  revealAll,
  adding,
  onToggleReveal,
  onApplyEdit,
  onRequestDelete,
  onStartAdding,
  onStopAdding,
}: VariablesEditorProps) {
  const entries = listVariables(document);
  const needle = search.trim().toLowerCase();
  // Search matches variable names only — never values.
  const visible =
    needle === ""
      ? entries
      : entries.filter((entry) => entry.node.key.toLowerCase().includes(needle));

  const isEmpty = entries.length === 0;
  const noMatches = !isEmpty && visible.length === 0;

  return (
    <div className="flex min-h-full flex-col">
      <div className="app-chrome grid grid-cols-[minmax(150px,240px)_1fr_auto] gap-2 border-b border-hairline px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
        <span className="px-2">Name</span>
        <span className="px-2">Value</span>
        <span className="w-[84px]" />
      </div>

      {visible.map((entry) => (
        <VariableRow
          key={entry.node.id}
          entry={entry}
          revealed={revealAll || revealedKeys.has(entry.node.key)}
          onToggleReveal={() => onToggleReveal(entry.node.key)}
          onKeyChange={(key) =>
            onApplyEdit((current) => setVariableKey(current, entry.node.id, key))
          }
          onValueChange={(value) =>
            onApplyEdit((current) =>
              setVariableValue(current, entry.node.id, value),
            )
          }
          onDelete={() => onRequestDelete(entry.node.key, entry.node.id)}
        />
      ))}

      {adding && (
        <NewVariableRow
          existingKeys={entries.map((entry) => entry.node.key)}
          onCommit={(key, value) => {
            onApplyEdit((current) => addVariable(current, key, value));
            onStopAdding();
          }}
          onCancel={onStopAdding}
        />
      )}

      {noMatches && !adding && (
        <Placeholder
          icon={<SearchX size={22} />}
          title="No matching variables"
          detail={`Nothing in this file matches “${search.trim()}”.`}
        />
      )}

      {isEmpty && !adding && (
        <Placeholder
          icon={<KeyRound size={22} />}
          title="No variables yet"
          detail="This environment file has no variables defined."
        />
      )}

      {!adding && (
        <div className="px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onStartAdding}>
            <Plus size={14} />
            Add variable
          </Button>
        </div>
      )}
    </div>
  );
}

function Placeholder({
  icon,
  title,
  detail,
}: {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly detail: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-14 text-center">
      <span className="text-ink-subtle">{icon}</span>
      <p className="text-[13px] font-medium text-ink">{title}</p>
      <p className="max-w-xs text-[12px] text-ink-muted">{detail}</p>
    </div>
  );
}
