import { describe, expect, it } from "vitest";

import { parse } from "./parse.ts";
import { serialize } from "./serialize.ts";
import { listVariables } from "./variables.ts";
import { decodeQuotedValue, encodeValue } from "./quoting.ts";
import type { EnvVariableNode } from "./types.ts";

/** The variables of a source string, as `[key, value]` pairs. */
function pairs(source: string): Array<[string, string]> {
  return listVariables(parse(source)).map(({ node }) => [node.key, node.value]);
}

function variable(source: string, key: string): EnvVariableNode {
  const found = listVariables(parse(source)).find(
    (entry) => entry.node.key === key,
  );
  if (found === undefined) {
    throw new Error(`No variable named ${key}`);
  }
  return found.node;
}

describe("parse — values", () => {
  it("reads plain values", () => {
    expect(pairs("NAME=keepenv\nPORT=3000\n")).toEqual([
      ["NAME", "keepenv"],
      ["PORT", "3000"],
    ]);
  });

  it("reads empty values", () => {
    expect(pairs("EMPTY_VALUE=\nALSO_EMPTY=\"\"\nAND_EMPTY=''\n")).toEqual([
      ["EMPTY_VALUE", ""],
      ["ALSO_EMPTY", ""],
      ["AND_EMPTY", ""],
    ]);
  });

  it("reads single quoted values literally", () => {
    expect(pairs("DATABASE_URL='postgres://localhost/test'\n")).toEqual([
      ["DATABASE_URL", "postgres://localhost/test"],
    ]);
    // No escape processing inside single quotes.
    expect(pairs("RAW='a\\nb'\n")).toEqual([["RAW", "a\\nb"]]);
  });

  it("reads double quoted values and their escapes", () => {
    expect(pairs('STRIPE_SECRET_KEY="sk_test_example"\n')).toEqual([
      ["STRIPE_SECRET_KEY", "sk_test_example"],
    ]);
    expect(pairs('MULTI="line1\\nline2"\n')).toEqual([
      ["MULTI", "line1\nline2"],
    ]);
    expect(pairs('QUOTED="say \\"hi\\""\n')).toEqual([
      ["QUOTED", 'say "hi"'],
    ]);
    expect(pairs('TAB="a\\tb"\n')).toEqual([["TAB", "a\tb"]]);
    // An escape Keepenv does not interpret keeps its backslash.
    expect(pairs('PATTERN="\\d+"\n')).toEqual([["PATTERN", "\\d+"]]);
  });

  it("reads backtick quoted values", () => {
    expect(pairs("TEMPLATE=`a 'b' \"c\"`\n")).toEqual([
      ["TEMPLATE", `a 'b' "c"`],
    ]);
  });

  it("keeps values that contain =", () => {
    expect(pairs("TOKEN=abc=def==\n")).toEqual([["TOKEN", "abc=def=="]]);
    expect(pairs('BASE64="YWJjZA==" \n')).toEqual([["BASE64", "YWJjZA=="]]);
    expect(pairs("CONNECTION='a=1;b=2'\n")).toEqual([
      ["CONNECTION", "a=1;b=2"],
    ]);
  });

  it("keeps URLs intact", () => {
    expect(
      pairs(
        "NEXT_PUBLIC_API_URL=http://localhost:3000\n" +
          "REDIS_URL=redis://:p%40ss@127.0.0.1:6379/0\n" +
          'CALLBACK="https://example.test/cb?a=1&b=2"\n',
      ),
    ).toEqual([
      ["NEXT_PUBLIC_API_URL", "http://localhost:3000"],
      ["REDIS_URL", "redis://:p%40ss@127.0.0.1:6379/0"],
      ["CALLBACK", "https://example.test/cb?a=1&b=2"],
    ]);
  });

  it("keeps JSON strings intact", () => {
    const source = `FIREBASE='{"projectId":"demo","keys":[1,2]}'\n`;
    expect(pairs(source)).toEqual([
      ["FIREBASE", '{"projectId":"demo","keys":[1,2]}'],
    ]);

    const escaped = 'CONFIG="{\\"a\\":\\"b\\"}"\n';
    expect(pairs(escaped)).toEqual([["CONFIG", '{"a":"b"}']]);
  });

  it("handles surrounding whitespace", () => {
    expect(pairs("  SPACED   =   value  \n")).toEqual([["SPACED", "value"]]);
    expect(pairs('PADDED="  keep me  "\n')).toEqual([["PADDED", "  keep me  "]]);
    expect(pairs("export EXPORTED=yes\n")).toEqual([["EXPORTED", "yes"]]);
  });
});

describe("parse — comments", () => {
  it("classifies whole-line comments", () => {
    const document = parse("# Stripe configuration\n   # indented\nA=1\n");
    expect(document.nodes.map((node) => node.kind)).toEqual([
      "comment",
      "comment",
      "variable",
    ]);
  });

  it("treats # as the end of a bare value, exactly like dotenv", () => {
    expect(pairs("KEY=value # trailing note\n")).toEqual([["KEY", "value"]]);
    // dotenv stops at the first #, even without preceding whitespace.
    expect(pairs("COLOR=#ff0000\n")).toEqual([["COLOR", ""]]);
    expect(pairs("PASSWORD=abc#def\n")).toEqual([["PASSWORD", "abc"]]);
  });

  it("keeps # inside quotes", () => {
    expect(pairs('COLOR="#ff0000"\n')).toEqual([["COLOR", "#ff0000"]]);
    expect(pairs("HASHED='a#b#c'\n")).toEqual([["HASHED", "a#b#c"]]);
    expect(pairs('QUOTED="v" # note\n')).toEqual([["QUOTED", "v"]]);
  });

  it("exposes the inline comment separately", () => {
    const [entry] = listVariables(parse("KEY=value   # why this exists\n"));
    expect(entry?.inlineComment).toBe("# why this exists");
    expect(entry?.node.suffix).toBe("   # why this exists");
  });
});

describe("parse — structure", () => {
  it("classifies blank lines", () => {
    const document = parse("A=1\n\n   \n\t\nB=2\n");
    expect(document.nodes.map((node) => node.kind)).toEqual([
      "variable",
      "blank",
      "blank",
      "blank",
      "variable",
    ]);
  });

  it("keeps malformed lines as unknown instead of guessing", () => {
    const document = parse(
      "A=1\nthis is not an assignment\n123=nope\n- item\nB=2\n",
    );
    expect(document.nodes.map((node) => node.kind)).toEqual([
      "variable",
      "unknown",
      "unknown",
      "unknown",
      "variable",
    ]);
  });

  it("treats an unterminated quote as unknown rather than swallowing the file", () => {
    const document = parse('BROKEN="never closed\nAFTER=fine\n');
    expect(document.nodes.map((node) => node.kind)).toEqual([
      "unknown",
      "variable",
    ]);
    expect(pairs('BROKEN="never closed\nAFTER=fine\n')).toEqual([
      ["AFTER", "fine"],
    ]);
  });

  it("reads multi-line quoted values as one variable", () => {
    const source =
      'PRIVATE_KEY="-----BEGIN KEY-----\nline-two\n-----END KEY-----"\nNEXT=1\n';
    const document = parse(source);
    expect(document.nodes.map((node) => node.kind)).toEqual([
      "variable",
      "variable",
    ]);
    const key = variable(source, "PRIVATE_KEY");
    expect(key.multiline).toBe(true);
    expect(key.value).toBe("-----BEGIN KEY-----\nline-two\n-----END KEY-----");
  });

  it("reports duplicate keys and marks the shadowed ones", () => {
    const entries = listVariables(parse("PORT=1\nOTHER=x\nPORT=2\n"));
    expect(entries.map((entry) => [entry.node.value, entry.isShadowed])).toEqual(
      [
        ["1", true],
        ["x", false],
        ["2", false],
      ],
    );
  });
});

describe("parse — line endings", () => {
  it("records each line's own terminator", () => {
    const document = parse("A=1\r\nB=2\nC=3");
    expect(document.nodes.map((node) => node.eol)).toEqual(["\r\n", "\n", ""]);
  });

  it("preserves a byte order mark", () => {
    const document = parse("\uFEFFA=1\n");
    expect(document.bom).toBe("\uFEFF");
    expect(document.nodes).toHaveLength(1);
  });
});

describe("round trip", () => {
  const samples: Array<[string, string]> = [
    ["empty file", ""],
    ["only a newline", "\n"],
    ["no trailing newline", "A=1"],
    ["crlf", "# c\r\nA=1\r\n\r\nB=2\r\n"],
    ["mixed endings", "A=1\r\nB=2\nC=3\rD=4"],
    ["bom", "\uFEFF# c\nA=1\n"],
    ["spacing", "  A   =   1   \n\texport B=2\n"],
    ["quotes", `A="1"\nB='2'\nC=\`3\`\nD=4\n`],
    ["inline comments", "A=1 # one\nB=2#two\n"],
    ["unknown lines", "??? nonsense\nA=1\n!!!\n"],
    ["unterminated quote", 'A="oops\nB=2\n'],
    ["multiline", 'K="a\nb\nc"\nZ=1\n'],
    ["duplicate keys", "A=1\nA=2\nA=3\n"],
    ["blank heavy", "\n\n\n   \n\t\n"],
    [
      "realistic",
      "# Stripe configuration\n\nSTRIPE_SECRET_KEY=\"sk_test_example\"\n\n" +
        "# Database\nDATABASE_URL='postgres://localhost/test'\n\nEMPTY_VALUE=\n",
    ],
  ];

  for (const [name, source] of samples) {
    it(`is lossless: ${name}`, () => {
      expect(serialize(parse(source))).toBe(source);
    });
  }
});

describe("quoting", () => {
  it("decode(encode(value)) is an identity", () => {
    const values = [
      "",
      "simple",
      "  padded  ",
      "with spaces",
      "a=b=c",
      "#hash",
      "trailing#",
      'quote " inside',
      "quote ' inside",
      "back ` tick",
      "back\\slash",
      "new\nline",
      "carriage\r\nreturn",
      "tab\there",
      '{"json":"value"}',
      "\\d+ regex",
      "emoji 🎉 value",
    ];

    for (const value of values) {
      for (const quote of ["none", "single", "double", "backtick"] as const) {
        const encoded = encodeValue(value, quote, false);
        const inner =
          encoded.quote === "none"
            ? encoded.text
            : encoded.text.slice(1, -1);
        expect(decodeQuotedValue(inner, encoded.quote)).toBe(value);
      }
    }
  });

  it("re-parses an encoded value to the same thing", () => {
    const values = [
      "plain",
      "  padded  ",
      "#ff0000",
      "a # b",
      'has "quotes"',
      "has 'quotes'",
      "multi\nline",
      "c:\\path\\to",
      '{"a":1}',
    ];

    for (const value of values) {
      const encoded = encodeValue(value, "none", false);
      const source = `KEY=${encoded.text}\n`;
      expect(variable(source, "KEY").value).toBe(value);
    }
  });
});
