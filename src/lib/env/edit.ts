/**
 * Editing operations on a parsed document.
 *
 * Each operation replaces exactly the node it targets and leaves every other
 * node's `raw` untouched, which is what makes an edit non-destructive to
 * comments, blank lines, ordering and unrelated formatting.
 */

import { renderVariable } from "./serialize.ts";
import type { EnvDocument, EnvNode, EnvVariableNode } from "./types.ts";

/** The line ending used by the majority of the file, defaulting to `\n`. */
export function dominantEol(document: EnvDocument): string {
  let crlf = 0;
  let lf = 0;
  for (const node of document.nodes) {
    if (node.eol === "\r\n") {
      crlf += 1;
    } else if (node.eol === "\n") {
      lf += 1;
    }
  }
  return crlf > lf ? "\r\n" : "\n";
}

function replaceNode(
  document: EnvDocument,
  id: string,
  update: (node: EnvVariableNode) => EnvVariableNode,
): EnvDocument {
  const index = document.nodes.findIndex((node) => node.id === id);
  const target = document.nodes[index];
  if (index === -1 || target === undefined || target.kind !== "variable") {
    return document;
  }
  const nodes = [...document.nodes];
  nodes[index] = renderVariable(update(target));
  return { ...document, nodes };
}

export function setVariableValue(
  document: EnvDocument,
  id: string,
  value: string,
): EnvDocument {
  return replaceNode(document, id, (node) => ({ ...node, value }));
}

export function setVariableKey(
  document: EnvDocument,
  id: string,
  key: string,
): EnvDocument {
  return replaceNode(document, id, (node) => ({ ...node, key }));
}

/** Removes a line entirely. */
export function removeNode(document: EnvDocument, id: string): EnvDocument {
  const index = document.nodes.findIndex((node) => node.id === id);
  const removed = document.nodes[index];
  if (index === -1 || removed === undefined) {
    return document;
  }

  const nodes = [...document.nodes];
  nodes.splice(index, 1);

  // Removing the final line of a file that had no trailing newline must not
  // introduce one.
  const newLast = nodes[nodes.length - 1];
  if (index === nodes.length && removed.eol === "" && newLast !== undefined) {
    nodes[nodes.length - 1] = { ...newLast, eol: "" };
  }

  return { ...document, nodes };
}

/**
 * Appends a variable to the end of the file.
 *
 * A file that did not end with a newline still does not; one that did, still
 * does.
 */
export function addVariable(
  document: EnvDocument,
  key: string,
  value: string,
): EnvDocument {
  const eol = dominantEol(document);
  const nodes: EnvNode[] = [...document.nodes];

  let terminator = eol;
  const last = nodes[nodes.length - 1];
  if (last !== undefined && last.eol === "") {
    nodes[nodes.length - 1] = { ...last, eol };
    terminator = "";
  }

  nodes.push(
    renderVariable({
      id: `n${nodes.length}`,
      kind: "variable",
      key,
      value,
      quote: "none",
      prefix: "",
      separator: "=",
      suffix: "",
      multiline: false,
      raw: "",
      eol: terminator,
    }),
  );

  return { ...document, nodes };
}
