/**
 * Views over a parsed document for the variables table.
 */

import { isVariableNode } from "./types.ts";
import type { EnvDocument, EnvVariableNode } from "./types.ts";

export interface VariableEntry {
  readonly node: EnvVariableNode;
  /** True when a later assignment to the same key wins at runtime. */
  readonly isShadowed: boolean;
  /** The inline comment that follows the value, if any. */
  readonly inlineComment: string;
}

function inlineCommentOf(node: EnvVariableNode): string {
  const hashIndex = node.suffix.indexOf("#");
  return hashIndex === -1 ? "" : node.suffix.slice(hashIndex).trim();
}

/** Every variable in file order, annotated for display. */
export function listVariables(document: EnvDocument): VariableEntry[] {
  const nodes = document.nodes.filter(isVariableNode);
  const lastIndexByKey = new Map<string, number>();
  nodes.forEach((node, index) => lastIndexByKey.set(node.key, index));

  return nodes.map((node, index) => ({
    node,
    isShadowed: lastIndexByKey.get(node.key) !== index,
    inlineComment: inlineCommentOf(node),
  }));
}

export function countVariables(document: EnvDocument): number {
  let total = 0;
  for (const node of document.nodes) {
    if (node.kind === "variable") {
      total += 1;
    }
  }
  return total;
}
