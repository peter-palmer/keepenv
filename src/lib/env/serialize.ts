/**
 * Turning a document back into file text.
 *
 * Serialization is a plain concatenation of each node's preserved source, so
 * nodes the user did not touch are written back byte for byte.
 */

import { encodeValue } from "./quoting.ts";
import type { EnvDocument, EnvVariableNode } from "./types.ts";

export function serialize(document: EnvDocument): string {
  let out = document.bom;
  for (const node of document.nodes) {
    out += node.raw + node.eol;
  }
  return out;
}

/**
 * Rebuilds a variable's source line from its parts.
 *
 * Indentation, an `export ` prefix, the spacing around `=` and any inline
 * comment are carried through unchanged; only the key and the encoded value
 * are rewritten.
 */
export function renderVariable(node: EnvVariableNode): EnvVariableNode {
  const encoded = encodeValue(node.value, node.quote, node.multiline);
  return {
    ...node,
    quote: encoded.quote,
    multiline: encoded.multiline,
    raw: node.prefix + node.key + node.separator + encoded.text + node.suffix,
  };
}
