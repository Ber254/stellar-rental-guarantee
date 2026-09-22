import { describe, expect, it } from "vitest";

import {
  acceptanceDeadline,
  feeForStroops,
  isPastAcceptanceDeadline,
  quoteFeeDecimal,
} from "./business-rules";

describe("feeForStroops", () => {
  it("charges 0.05% rounded up to the stroop", () => {
    expect(feeForStroops(10_000_000_000n)).toBe(5_000_000n); // 1000 USDC -> 0.5 USDC
    expect(feeForStroops(4_000_000_000n)).toBe(2_000_000n); // 400 USDC -> 0.2 USDC
    expect(feeForStroops(1n)).toBe(1n); // rounds up, never charges zero on a positive amount
  });

  it("charges nothing on zero or negative amounts", () => {
    expect(feeForStroops(0n)).toBe(0n);
    expect(feeForStroops(-100n)).toBe(0n);
  });
});

describe("quoteFeeDecimal", () => {
  it("matches the on-chain rounding for a whole-USDC amount", () => {
    const quote = quoteFeeDecimal("1000");
    expect(quote.fee).toBe("0.5");
    expect(quote.net).toBe("999.5");
  });

  it("never lets the net exceed the returned amount", () => {
    const quote = quoteFeeDecimal("0.0000001");
    expect(Number(quote.net)).toBeLessThanOrEqual(Number(quote.amount));
  });
});

describe("acceptance deadline", () => {
  it("is 30 days after the period start", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(acceptanceDeadline(start).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("flags a guarantee as past due only after the deadline", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(isPastAcceptanceDeadline(start, new Date("2026-01-30T00:00:00Z"))).toBe(false);
    expect(isPastAcceptanceDeadline(start, new Date("2026-02-01T00:00:00Z"))).toBe(true);
  });
});
