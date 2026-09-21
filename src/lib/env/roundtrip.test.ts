import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { addVariable, listVariables, parse, removeNode, serialize, setVariableValue } from "./index.ts";

/**
 * End-to-end check against a real file on disk.
 *
 * This mirrors exactly what the editor does — read the file, parse it, apply a
 * single edit, serialize, write it back — and asserts that nothing except the
 * edited line moved.
 */

const workspace = mkdtempSync(join(tmpdir(), "keepenv-roundtrip-"));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

const ORIGINAL = [
  "# Stripe configuration",
  "",
  'STRIPE_SECRET_KEY="sk_test_example"',
  "",
  "# Database",
  "DATABASE_URL='postgres://localhost/test'",
  "",
  "EMPTY_VALUE=",
  "",
  "NEXT_PUBLIC_API_URL=http://localhost:3000",
  "  export LEGACY_TOKEN = abc123   # kept from the old setup",
  "",
].join("\n");

function editOnDisk(
  path: string,
  edit: (text: string) => string,
): { before: string; after: string } {
  const before = readFileSync(path, "utf8");
  const after = edit(before);
  writeFileSync(path, after, "utf8");
  return { before, after: readFileSync(path, "utf8") };
}

function valueOf(text: string, key: string): string | undefined {
  return listVariables(parse(text)).find((entry) => entry.node.key === key)?.node
    .value;
}

function idOf(text: string, key: string): string {
  const entry = listVariables(parse(text)).find(
    (item) => item.node.key === key,
  );
  if (entry === undefined) {
    throw new Error(`No variable named ${key}`);
  }
  return entry.node.id;
}

describe("editing a real file on disk", () => {
  it("changes only the edited variable", () => {
    const path = join(workspace, ".env");
    writeFileSync(path, ORIGINAL, "utf8");

    const { before, after } = editOnDisk(path, (text) => {
      const document = parse(text);
      return serialize(
        setVariableValue(
          document,
          idOf(text, "DATABASE_URL"),
          "postgres://localhost/production",
        ),
      );
    });

    expect(valueOf(after, "DATABASE_URL")).toBe(
      "postgres://localhost/production",
    );

    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");
    expect(afterLines).toHaveLength(beforeLines.length);

    const changed = beforeLines
      .map((line, index) => (afterLines[index] === line ? null : index))
      .filter((index): index is number => index !== null);

    expect(changed).toHaveLength(1);
    expect(beforeLines[changed[0] ?? -1]).toContain("DATABASE_URL");
    // Quoting style survived.
    expect(afterLines[changed[0] ?? -1]).toBe(
      "DATABASE_URL='postgres://localhost/production'",
    );
  });

  it("keeps comments, spacing and the export prefix", () => {
    const path = join(workspace, ".env.spacing");
    writeFileSync(path, ORIGINAL, "utf8");

    const { after } = editOnDisk(path, (text) =>
      serialize(setVariableValue(parse(text), idOf(text, "LEGACY_TOKEN"), "xyz789")),
    );

    expect(after).toContain(
      "  export LEGACY_TOKEN = xyz789   # kept from the old setup",
    );
    expect(after).toContain("# Stripe configuration");
    expect(after).toContain("# Database");
  });

  it("survives a CRLF file", () => {
    const path = join(workspace, ".env.production");
    const source = "NODE_ENV=production\r\nAPI_URL=https://api.example.test\r\n";
    writeFileSync(path, source, "utf8");

    const { after } = editOnDisk(path, (text) =>
      serialize(setVariableValue(parse(text), idOf(text, "NODE_ENV"), "staging")),
    );

    expect(after).toBe("NODE_ENV=staging\r\nAPI_URL=https://api.example.test\r\n");
  });

  it("adds and removes variables without disturbing the file", () => {
    const path = join(workspace, ".env.add");
    writeFileSync(path, ORIGINAL, "utf8");

    editOnDisk(path, (text) =>
      serialize(addVariable(parse(text), "NEW_TOKEN", "value with spaces")),
    );
    let contents = readFileSync(path, "utf8");
    expect(contents.startsWith(ORIGINAL)).toBe(true);
    expect(contents).toContain('NEW_TOKEN="value with spaces"');
    expect(valueOf(contents, "NEW_TOKEN")).toBe("value with spaces");

    editOnDisk(path, (text) =>
      serialize(removeNode(parse(text), idOf(text, "NEW_TOKEN"))),
    );
    contents = readFileSync(path, "utf8");
    expect(contents).toBe(ORIGINAL);
  });

  it("writes back an untouched file byte for byte", () => {
    const path = join(workspace, ".env.untouched");
    writeFileSync(path, ORIGINAL, "utf8");

    const { after } = editOnDisk(path, (text) => serialize(parse(text)));
    expect(after).toBe(ORIGINAL);
  });
});
