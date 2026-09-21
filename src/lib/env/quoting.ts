/**
 * Decoding and encoding of environment values.
 *
 * ## Escape handling
 *
 * Inside double quotes Keepenv recognises `\\`, `\"`, `\$`, `\n`, `\r` and
 * `\t`. A backslash before anything else is kept literally, so a regular
 * expression such as `"\d+"` survives untouched.
 *
 * `decode(encode(value))` is an exact identity for every value, which is the
 * property that matters: whatever the editor displays is what gets written
 * back. (The reverse is not an identity for unusual inputs — `"\d"` re-encodes
 * to `"\\d"` — but that only happens when the user actually edits that value,
 * and the decoded result is unchanged.)
 *
 * Single quotes and backticks are literal, exactly like POSIX single quotes.
 * A value containing the quote character is therefore promoted to double
 * quotes rather than being escaped.
 */

import type { QuoteStyle } from "./types.ts";

/** True when the style uses backslash escapes. */
export function supportsEscapes(quote: QuoteStyle): boolean {
  return quote === "double";
}

/** The delimiter for a quote style, or `""` for unquoted values. */
export function quoteCharacter(quote: QuoteStyle): string {
  switch (quote) {
    case "single":
      return "'";
    case "double":
      return '"';
    case "backtick":
      return "`";
    case "none":
      return "";
  }
}

/** Maps an opening delimiter to its quote style. */
export function quoteStyleFor(character: string): QuoteStyle | null {
  switch (character) {
    case "'":
      return "single";
    case '"':
      return "double";
    case "`":
      return "backtick";
    default:
      return null;
  }
}

/** Turns the text between two delimiters into the value an app would see. */
export function decodeQuotedValue(inner: string, quote: QuoteStyle): string {
  if (!supportsEscapes(quote)) {
    return inner;
  }
  let out = "";
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner.charAt(index);
    if (character !== "\\") {
      out += character;
      continue;
    }
    const next = inner.charAt(index + 1);
    switch (next) {
      case "n":
        out += "\n";
        index += 1;
        break;
      case "r":
        out += "\r";
        index += 1;
        break;
      case "t":
        out += "\t";
        index += 1;
        break;
      case "\\":
        out += "\\";
        index += 1;
        break;
      case '"':
        out += '"';
        index += 1;
        break;
      case "$":
        out += "$";
        index += 1;
        break;
      default:
        // A lone backslash, or an escape Keepenv does not interpret.
        out += "\\";
        break;
    }
  }
  return out;
}

function escapeForDoubleQuotes(value: string, keepNewlines: boolean): string {
  let out = "";
  for (const character of value) {
    switch (character) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\n":
        out += keepNewlines ? "\n" : "\\n";
        break;
      case "\r":
        out += keepNewlines ? "\r" : "\\r";
        break;
      default:
        out += character;
    }
  }
  return out;
}

/**
 * Whether a value needs delimiters to survive a round trip.
 *
 * Whitespace anywhere is quoted: `dotenv` itself copes with a bare
 * `KEY=two words`, but `source .env` and `docker compose --env-file` do not,
 * and a secrets file should stay readable by all of them.
 *
 * Beyond that, only the cases that genuinely change meaning force quotes — a
 * quote character in the middle of a bare value (`don't`) is left alone so
 * edits stay minimal.
 */
export function requiresQuoting(value: string): boolean {
  if (value === "") {
    return false;
  }
  if (/\s/.test(value)) {
    return true;
  }
  if (value.includes("#")) {
    return true;
  }
  return /^["'`]/.test(value);
}

export interface EncodedValue {
  /** The value including any delimiters, ready to drop into a line. */
  readonly text: string;
  /** The style actually used, which may be an upgrade of the preferred one. */
  readonly quote: QuoteStyle;
  readonly multiline: boolean;
}

/**
 * Renders a value, keeping the file's existing quoting style whenever that
 * style can still express the value, and upgrading to double quotes when it
 * cannot.
 */
export function encodeValue(
  value: string,
  preferred: QuoteStyle,
  allowLiteralNewlines: boolean,
): EncodedValue {
  const hasNewline = /[\n\r]/.test(value);

  let quote: QuoteStyle = preferred;
  if (preferred === "none" && requiresQuoting(value)) {
    quote = "double";
  } else if (preferred === "single" && value.includes("'")) {
    quote = "double";
  } else if (preferred === "backtick" && value.includes("`")) {
    quote = "double";
  }

  if (quote === "none") {
    return { text: value, quote, multiline: false };
  }

  if (quote === "double") {
    const keepNewlines = allowLiteralNewlines && hasNewline;
    return {
      text: `"${escapeForDoubleQuotes(value, keepNewlines)}"`,
      quote,
      multiline: keepNewlines,
    };
  }

  const delimiter = quoteCharacter(quote);
  return {
    text: `${delimiter}${value}${delimiter}`,
    quote,
    multiline: hasNewline,
  };
}
