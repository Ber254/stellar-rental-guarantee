import { describe, expect, it } from "vitest";

import { assertTransition, canTransition } from "./contract-state";

describe("guarantee lifecycle", () => {
  it("allows the happy path", () => {
    const path = [
      "DRAFT",
      "PENDING_ACCEPTANCE",
      "AWAITING_FUNDING",
      "ACTIVE",
      "RETURN_REQUESTED",
      "NEGOTIATION",
      "AGREED",
      "COMPLETED",
    ] as const;

    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransition(path[index], path[index + 1])).toBe(true);
    }
  });

  it("supports a partial return that keeps the guarantee active", () => {
    expect(canTransition("AGREED", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "RETURN_REQUESTED")).toBe(true);
  });

  it("never reopens a finished guarantee", () => {
    expect(canTransition("COMPLETED", "NEGOTIATION")).toBe(false);
    expect(canTransition("RELEASED", "ACTIVE")).toBe(false);
    expect(canTransition("CANCELLED", "ACTIVE")).toBe(false);
    expect(canTransition("REJECTED", "AWAITING_FUNDING")).toBe(false);
  });

  it("cannot skip funding", () => {
    expect(canTransition("PENDING_ACCEPTANCE", "ACTIVE")).toBe(false);
    expect(() => assertTransition("AWAITING_FUNDING", "COMPLETED")).toThrow();
  });

  it("expires back into an active or negotiating guarantee", () => {
    expect(canTransition("EXPIRED", "ACTIVE")).toBe(true);
    expect(canTransition("EXPIRED", "RETURN_REQUESTED")).toBe(true);
  });
});
