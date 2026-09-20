import { describe, expect, it } from "vitest";

import { amountsWithinLocked, formatUsdc, fromStroops, toStroops } from "./money";

describe("stroop conversion", () => {
  it("keeps 7 decimals exactly", () => {
    expect(toStroops("1000")).toBe(10_000_000_000n);
    expect(toStroops("0.0000001")).toBe(1n);
    expect(fromStroops(10_000_000_000n)).toBe("1000");
    expect(fromStroops(1n)).toBe("0.0000001");
  });

  it("does not lose precision on values that break floats", () => {
    expect(toStroops("0.1") + toStroops("0.2")).toBe(toStroops("0.3"));
  });

  it("rejects malformed and over-precise amounts", () => {
    expect(() => toStroops("1.00000001")).toThrow();
    expect(() => toStroops("abc")).toThrow();
    expect(() => toStroops("")).toThrow();
  });

  it("formats for display", () => {
    expect(formatUsdc("1000")).toBe("1,000 USDC");
    expect(formatUsdc("1000.5")).toBe("1,000.50 USDC");
  });
});

describe("amountsWithinLocked", () => {
  it("accepts splits at or below the locked amount", () => {
    expect(amountsWithinLocked("300", "700", "1000")).toBe(true);
    expect(amountsWithinLocked("0", "1000", "1000")).toBe(true);
    expect(amountsWithinLocked("150.5", "849.5", "1000")).toBe(true);
    expect(amountsWithinLocked("300", "0", "1000")).toBe(true);
  });

  it("rejects splits that exceed the locked amount", () => {
    expect(amountsWithinLocked("1000", "1000", "1000")).toBe(false);
    expect(amountsWithinLocked("600", "500", "1000")).toBe(false);
  });
});
