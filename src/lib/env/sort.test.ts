import { describe, expect, it } from "vitest";

import { sortEnvFileNames } from "./sort.ts";
import { validateEnvFileName, validateVariableKey } from "./validate.ts";

describe("environment file ordering", () => {
  it("puts the common files in a predictable order", () => {
    const files = [
      ".env.test",
      ".env.production",
      ".env.example",
      ".env.local",
      ".env",
      ".env.development",
      ".env.staging",
      ".env.zzz",
    ].map((name) => ({ name }));

    expect(sortEnvFileNames(files).map((file) => file.name)).toEqual([
      ".env",
      ".env.local",
      ".env.development",
      ".env.staging",
      ".env.production",
      ".env.test",
      ".env.example",
      ".env.zzz",
    ]);
  });

  it("groups templates together regardless of their environment", () => {
    const files = [".env.production.example", ".env.production"].map((name) => ({
      name,
    }));
    expect(sortEnvFileNames(files).map((file) => file.name)).toEqual([
      ".env.production",
      ".env.production.example",
    ]);
  });

  it("sorts alphabetically inside a group", () => {
    const files = [".env.development.local", ".env.development"].map((name) => ({
      name,
    }));
    expect(sortEnvFileNames(files).map((file) => file.name)).toEqual([
      ".env.development",
      ".env.development.local",
    ]);
  });
});

describe("validation", () => {
  it("accepts environment file names", () => {
    for (const name of [".env", ".env.local", ".env.production", ".env-ci", ".env_1"]) {
      expect(validateEnvFileName(name)).toBeNull();
    }
  });

  it("rejects paths, traversal and non-env names", () => {
    for (const name of ["", "env", "../.env", ".env/../x", ".env..a", "config.json", ".env."]) {
      expect(validateEnvFileName(name)).not.toBeNull();
    }
  });

  it("rejects duplicates", () => {
    expect(validateEnvFileName(".env.local", [".env", ".env.local"])).not.toBeNull();
  });

  it("validates variable keys", () => {
    expect(validateVariableKey("DATABASE_URL")).toBeNull();
    expect(validateVariableKey("_private")).toBeNull();
    expect(validateVariableKey("app.name")).toBeNull();
    expect(validateVariableKey("")).not.toBeNull();
    expect(validateVariableKey("1BAD")).not.toBeNull();
    expect(validateVariableKey("has space")).not.toBeNull();
  });
});
