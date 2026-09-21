import { describe, expect, it } from "vitest";

import { addVariable, removeNode, setVariableKey, setVariableValue } from "./edit.ts";
import { parse } from "./parse.ts";
import { serialize } from "./serialize.ts";
import { listVariables } from "./variables.ts";

/** Applies an edit to a variable identified by key and returns the new text. */
function editValue(source: string, key: string, value: string): string {
  const document = parse(source);
  const entry = listVariables(document).find((item) => item.node.key === key);
  if (entry === undefined) {
    throw new Error(`No variable named ${key}`);
  }
  return serialize(setVariableValue(document, entry.node.id, value));
}

const REALISTIC = [
  "# Stripe configuration",
  "",
  'STRIPE_SECRET_KEY="sk_test_example"',
  "",
  "# Database",
  "DATABASE_URL='postgres://localhost/test'",
  "",
  "EMPTY_VALUE=",
  "",
].join("\n");

describe("editing preserves the rest of the file", () => {
  it("changes only the edited line", () => {
    const next = editValue(REALISTIC, "DATABASE_URL", "postgres://localhost/prod");

    expect(next).toBe(
      [
        "# Stripe configuration",
        "",
        'STRIPE_SECRET_KEY="sk_test_example"',
        "",
        "# Database",
        "DATABASE_URL='postgres://localhost/prod'",
        "",
        "EMPTY_VALUE=",
        "",
      ].join("\n"),
    );
  });

  it("keeps comments, blank lines and ordering byte for byte", () => {
    const before = REALISTIC.split("\n");
    const after = editValue(REALISTIC, "DATABASE_URL", "changed").split("\n");

    expect(after).toHaveLength(before.length);
    before.forEach((line, index) => {
      if (line.startsWith("DATABASE_URL")) {
        return;
      }
      expect(after[index]).toBe(line);
    });
  });

  it("keeps the original quoting style", () => {
    expect(editValue('A="one"\n', "A", "two")).toBe('A="two"\n');
    expect(editValue("A='one'\n", "A", "two")).toBe("A='two'\n");
    expect(editValue("A=one\n", "A", "two")).toBe("A=two\n");
    expect(editValue("A=`one`\n", "A", "two")).toBe("A=`two`\n");
  });

  it("keeps indentation, export and spacing around =", () => {
    expect(editValue("  export   A   =   one   \n", "A", "two")).toBe(
      "  export   A   =   two   \n",
    );
  });

  it("keeps an inline comment", () => {
    expect(editValue("A=one # why\n", "A", "two")).toBe("A=two # why\n");
  });

  it("keeps CRLF endings", () => {
    expect(editValue("A=1\r\nB=2\r\n", "A", "9")).toBe("A=9\r\nB=2\r\n");
  });

  it("does not add a trailing newline to a file that lacks one", () => {
    expect(editValue("A=1\nB=2", "B", "9")).toBe("A=1\nB=9");
  });

  it("leaves unknown lines untouched", () => {
    const source = "??? junk\nA=1\n!!! more junk\n";
    expect(editValue(source, "A", "2")).toBe("??? junk\nA=2\n!!! more junk\n");
  });

  it("edits only the targeted duplicate", () => {
    const document = parse("PORT=1\nPORT=2\nPORT=3\n");
    const entries = listVariables(document);
    const second = entries[1];
    expect(second).toBeDefined();
    const next = serialize(setVariableValue(document, second!.node.id, "9"));
    expect(next).toBe("PORT=1\nPORT=9\nPORT=3\n");
  });
});

describe("editing upgrades quoting only when it must", () => {
  it("quotes a bare value that gains a #", () => {
    expect(editValue("COLOR=red\n", "COLOR", "#ff0000")).toBe(
      'COLOR="#ff0000"\n',
    );
  });

  it("quotes a bare value that gains spaces or padding", () => {
    expect(editValue("A=x\n", "A", "two words")).toBe('A="two words"\n');
    expect(editValue("A=x\n", "A", " pad ")).toBe('A=" pad "\n');
  });

  it("escapes newlines rather than breaking the line", () => {
    expect(editValue("A=x\n", "A", "one\ntwo")).toBe('A="one\\ntwo"\n');
  });

  it("promotes single quotes to double when the value contains an apostrophe", () => {
    expect(editValue("A='x'\n", "A", "it's")).toBe(`A="it's"\n`);
  });

  it("keeps a multi-line value on multiple lines", () => {
    const source = 'KEY="a\nb"\nNEXT=1\n';
    expect(editValue(source, "KEY", "a\nb\nc")).toBe('KEY="a\nb\nc"\nNEXT=1\n');
  });

  it("does not quote values that are fine bare", () => {
    expect(editValue("A=x\n", "A", "postgres://user@host:5432/db")).toBe(
      "A=postgres://user@host:5432/db\n",
    );
    expect(editValue("A=x\n", "A", "a=b=c")).toBe("A=a=b=c\n");
  });
});

describe("renaming, adding and removing", () => {
  it("renames a key in place", () => {
    const document = parse("# note\nOLD_NAME=value # keep\nAFTER=1\n");
    const entry = listVariables(document)[0];
    expect(entry).toBeDefined();
    const next = serialize(setVariableKey(document, entry!.node.id, "NEW_NAME"));
    expect(next).toBe("# note\nNEW_NAME=value # keep\nAFTER=1\n");
  });

  it("appends a variable at the end", () => {
    expect(serialize(addVariable(parse("A=1\n"), "B", "2"))).toBe("A=1\nB=2\n");
  });

  it("appends to an empty file", () => {
    expect(serialize(addVariable(parse(""), "A", "1"))).toBe("A=1\n");
  });

  it("appends without introducing a trailing newline", () => {
    expect(serialize(addVariable(parse("A=1"), "B", "2"))).toBe("A=1\nB=2");
  });

  it("appends using the file's dominant line ending", () => {
    expect(serialize(addVariable(parse("A=1\r\nB=2\r\n"), "C", "3"))).toBe(
      "A=1\r\nB=2\r\nC=3\r\n",
    );
  });

  it("quotes an appended value when needed", () => {
    expect(serialize(addVariable(parse("A=1\n"), "B", "two words"))).toBe(
      'A=1\nB="two words"\n',
    );
  });

  it("removes only the targeted line", () => {
    const document = parse("# keep\nA=1\n\nB=2\n");
    const entry = listVariables(document).find((item) => item.node.key === "A");
    expect(entry).toBeDefined();
    expect(serialize(removeNode(document, entry!.node.id))).toBe(
      "# keep\n\nB=2\n",
    );
  });

  it("removing the last line does not add a trailing newline", () => {
    const document = parse("A=1\nB=2");
    const entry = listVariables(document).find((item) => item.node.key === "B");
    expect(entry).toBeDefined();
    expect(serialize(removeNode(document, entry!.node.id))).toBe("A=1");
  });
});
