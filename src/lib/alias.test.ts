import { describe, expect, it } from "vitest";

// The db client is built at import time; this file only exercises pure helpers.
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/test";

const { ALIAS_PATTERN, isValidAlias, normalizeAlias } = await import("./alias");

describe("normalizeAlias", () => {
  it("trims and lowercases", () => {
    expect(normalizeAlias("  Juan.Perez  ")).toBe("juan.perez");
  });
});

describe("isValidAlias", () => {
  it("accepts lowercase letters, digits, dot, dash and underscore", () => {
    for (const alias of ["juan.perez", "maria-gomez", "depto_4b", "abc", "a".repeat(30)]) {
      expect(isValidAlias(alias)).toBe(true);
    }
  });

  it("rejects anything shorter than 3 or longer than 30 characters", () => {
    expect(isValidAlias("ab")).toBe(false);
    expect(isValidAlias("a".repeat(31))).toBe(false);
  });

  it("rejects a leading or trailing separator", () => {
    expect(isValidAlias(".juan")).toBe(false);
    expect(isValidAlias("juan.")).toBe(false);
    expect(isValidAlias("-juan")).toBe(false);
  });

  it("rejects uppercase, spaces and other symbols", () => {
    expect(isValidAlias("Juan.Perez")).toBe(false);
    expect(isValidAlias("juan perez")).toBe(false);
    expect(isValidAlias("juan@perez")).toBe(false);
  });

  it("matches the pattern used for the HTML input", () => {
    expect(ALIAS_PATTERN.test("juan.perez")).toBe(true);
  });
});
