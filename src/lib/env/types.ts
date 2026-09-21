/**
 * The line-oriented representation of an environment file.
 *
 * Every node carries `raw` — its exact original source text — and its own line
 * terminator. Serialization is a plain concatenation, which makes
 * `serialize(parse(text)) === text` hold for *any* input, including mixed
 * CRLF/LF files, files without a trailing newline, and files Keepenv cannot
 * fully understand.
 *
 * Editing a variable recomputes `raw` for that one node only. Every other node
 * is written back byte for byte, so comments, blank lines, ordering and
 * unrelated quoting cannot be disturbed by an edit.
 */

export type QuoteStyle = "none" | "single" | "double" | "backtick";

export type EnvNodeKind = "variable" | "comment" | "blank" | "unknown";

interface EnvNodeBase {
  /** Identity within one parsed document; stable across value and key edits. */
  readonly id: string;
  /** The node's exact original text, excluding its line terminator. */
  readonly raw: string;
  /** The terminator that followed this node: `""`, `"\n"`, `"\r\n"` or `"\r"`. */
  readonly eol: string;
}

export interface EnvVariableNode extends EnvNodeBase {
  readonly kind: "variable";
  readonly key: string;
  /** The decoded value, as the application would see it. */
  readonly value: string;
  readonly quote: QuoteStyle;
  /** Everything before the key: indentation and an optional `export `. */
  readonly prefix: string;
  /** The literal text between key and value, e.g. `"="` or `" = "`. */
  readonly separator: string;
  /** Everything after the value token: trailing spaces and an inline comment. */
  readonly suffix: string;
  /** True when the quoted value spans more than one physical line. */
  readonly multiline: boolean;
}

export interface EnvCommentNode extends EnvNodeBase {
  readonly kind: "comment";
}

export interface EnvBlankNode extends EnvNodeBase {
  readonly kind: "blank";
}

/**
 * A line Keepenv could not classify. It is preserved verbatim and never
 * rewritten — the editor refuses to guess at syntax it does not understand.
 */
export interface EnvUnknownNode extends EnvNodeBase {
  readonly kind: "unknown";
}

export type EnvNode =
  | EnvVariableNode
  | EnvCommentNode
  | EnvBlankNode
  | EnvUnknownNode;

export interface EnvDocument {
  /** A byte-order mark, preserved verbatim when the file had one. */
  readonly bom: string;
  readonly nodes: readonly EnvNode[];
}

export function isVariableNode(node: EnvNode): node is EnvVariableNode {
  return node.kind === "variable";
}
