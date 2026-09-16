import { describe, expect, it } from "vitest";

import { assertTransition, canTransition } from "./contract-state";

describe("contract lifecycle", () => {
  it("allows the happy path", () => {
    const path = [
      "DRAFT",
      "PENDING_ACCEPTANCE",
      "AWAITING_FUNDING",
      "ACTIVE",
      "RETURN_REQUESTED",
      "NEGOTIATION",
      "AGREED",
      "RELEASED",
      "COMPLETED",
    ] as const;

    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransition(path[index], path[index + 1])).toBe(true);
    }
  });

  it("never reopens a finished guarantee", () => {
    expect(canTransition("COMPLETED", "NEGOTIATION")).toBe(false);
    expect(canTransition("RELEASED", "ACTIVE")).toBe(false);
    expect(canTransition("CANCELLED", "ACTIVE")).toBe(false);
  });

  it("cannot skip funding", () => {
    expect(canTransition("PENDING_ACCEPTANCE", "ACTIVE")).toBe(false);
    expect(() => assertTransition("AWAITING_FUNDING", "RELEASED")).toThrow();
  });
});
