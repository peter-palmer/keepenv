/**
 * The `.env` parser.
 *
 * Parsing is deliberately conservative: a line Keepenv does not fully
 * understand becomes an `unknown` node and is preserved verbatim rather than
 * being guessed at. Nothing here mutates or normalises the source.
 *
 * ## Inline comments
 *
 * For an *unquoted* value, `#` starts a comment wherever it appears — the same
 * rule `dotenv` applies, and therefore what Node, Vite and Next.js actually
 * see. `COLOR=#ff0000` really does reach an application as an empty string,
 * and Keepenv reports that faithfully instead of showing a value the app will
 * never receive. Quoting the value (which Keepenv does automatically when you
 * edit it) is the fix.
 */

import { decodeQuotedValue, quoteStyleFor, supportsEscapes } from "./quoting.ts";
import type {
  EnvDocument,
  EnvNode,
  EnvVariableNode,
  QuoteStyle,
} from "./types.ts";

const BOM = "﻿";

/**
 * Keys must start with a letter or underscore. Anything looser would classify
 * ordinary prose and YAML fragments as assignments.
 */
const VARIABLE_PATTERN =
  /^([ \t]*(?:export[ \t]+)?)([A-Za-z_][A-Za-z0-9_.-]*)([ \t]*=[ \t]*)([\s\S]*)$/;

interface PhysicalLine {
  readonly text: string;
  readonly eol: string;
}

/** Splits text into lines, keeping each line's own terminator. */
function splitPhysicalLines(input: string): PhysicalLine[] {
  const lines: PhysicalLine[] = [];
  const pattern = /\r\n|\n|\r/g;
  let start = 0;
  let match = pattern.exec(input);

  while (match !== null) {
    lines.push({ text: input.slice(start, match.index), eol: match[0] });
    start = match.index + match[0].length;
    match = pattern.exec(input);
  }
  if (start < input.length) {
    lines.push({ text: input.slice(start), eol: "" });
  }
  return lines;
}

interface ScannedValue {
  readonly value: string;
  readonly quote: QuoteStyle;
  readonly suffix: string;
  /** The exact source text of the value and everything after it. */
  readonly rawTail: string;
  /** How many *additional* physical lines the value spans. */
  readonly extraLines: number;
  readonly multiline: boolean;
}

/** Scans an unquoted value, which ends at the first `#` or the line's end. */
function scanBareValue(rest: string): ScannedValue {
  const hashIndex = rest.indexOf("#");
  const valueRegion = hashIndex === -1 ? rest : rest.slice(0, hashIndex);
  const comment = hashIndex === -1 ? "" : rest.slice(hashIndex);
  const value = valueRegion.replace(/[ \t]+$/, "");

  return {
    value,
    quote: "none",
    suffix: valueRegion.slice(value.length) + comment,
    rawTail: rest,
    extraLines: 0,
    multiline: false,
  };
}

/**
 * Scans a quoted value, continuing onto following lines when the closing
 * delimiter is not on this one. Returns `null` for an unterminated quote so
 * the caller can fall back to an `unknown` node instead of swallowing the rest
 * of the file.
 */
function scanQuotedValue(
  rest: string,
  lines: readonly PhysicalLine[],
  startIndex: number,
  quote: QuoteStyle,
): ScannedValue | null {
  const delimiter = rest.charAt(0);
  const escapes = supportsEscapes(quote);

  let buffer = rest;
  let cursor = 1;
  let extraLines = 0;
  let closeIndex = -1;

  for (;;) {
    while (cursor < buffer.length) {
      const character = buffer.charAt(cursor);
      if (escapes && character === "\\") {
        cursor += 2;
        continue;
      }
      if (character === delimiter) {
        closeIndex = cursor;
        break;
      }
      cursor += 1;
    }
    if (closeIndex !== -1) {
      break;
    }

    const current = lines[startIndex + extraLines];
    const next = lines[startIndex + extraLines + 1];
    if (current === undefined || next === undefined) {
      return null;
    }
    buffer += current.eol + next.text;
    extraLines += 1;
  }

  const inner = buffer.slice(1, closeIndex);
  return {
    value: decodeQuotedValue(inner, quote),
    quote,
    suffix: buffer.slice(closeIndex + 1),
    rawTail: buffer,
    extraLines,
    multiline: extraLines > 0,
  };
}

interface ParsedVariable {
  readonly node: EnvVariableNode;
  readonly extraLines: number;
}

function parseVariable(
  lines: readonly PhysicalLine[],
  index: number,
  id: string,
): ParsedVariable | null {
  const line = lines[index];
  if (line === undefined) {
    return null;
  }
  const match = VARIABLE_PATTERN.exec(line.text);
  if (match === null) {
    return null;
  }

  const [, prefix = "", key = "", separator = "", rest = ""] = match;
  const quote = quoteStyleFor(rest.charAt(0));
  const scanned =
    quote === null
      ? scanBareValue(rest)
      : scanQuotedValue(rest, lines, index, quote);

  if (scanned === null) {
    return null;
  }

  const last = lines[index + scanned.extraLines];
  const node: EnvVariableNode = {
    id,
    kind: "variable",
    key,
    value: scanned.value,
    quote: scanned.quote,
    prefix,
    separator,
    suffix: scanned.suffix,
    multiline: scanned.multiline,
    raw: prefix + key + separator + scanned.rawTail,
    eol: last?.eol ?? "",
  };

  return { node, extraLines: scanned.extraLines };
}

/**
 * Parses an environment file.
 *
 * Guarantees `serialize(parse(text)) === text` for every input.
 */
export function parse(text: string): EnvDocument {
  const hasBom = text.startsWith(BOM);
  const body = hasBom ? text.slice(BOM.length) : text;
  const lines = splitPhysicalLines(body);
  const nodes: EnvNode[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined) {
      break;
    }
    const id = `n${nodes.length}`;

    if (line.text.trim() === "") {
      nodes.push({ id, kind: "blank", raw: line.text, eol: line.eol });
      index += 1;
      continue;
    }

    if (line.text.trimStart().startsWith("#")) {
      nodes.push({ id, kind: "comment", raw: line.text, eol: line.eol });
      index += 1;
      continue;
    }

    const variable = parseVariable(lines, index, id);
    if (variable !== null) {
      nodes.push(variable.node);
      index += variable.extraLines + 1;
      continue;
    }

    nodes.push({ id, kind: "unknown", raw: line.text, eol: line.eol });
    index += 1;
  }

  return { bom: hasBom ? BOM : "", nodes };
}
