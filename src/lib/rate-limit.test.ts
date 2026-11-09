import { describe, expect, it } from "vitest";

import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests within the window and blocks once the limit is reached", () => {
    const key = "test:127.0.0.1";
    const t0 = 1_000_000;
    expect(checkRateLimit(key, 3, 60_000, t0)).toEqual({
      allowed: true,
      remaining: 2,
    });
    expect(checkRateLimit(key, 3, 60_000, t0 + 100)).toEqual({
      allowed: true,
      remaining: 1,
    });
    expect(checkRateLimit(key, 3, 60_000, t0 + 200)).toEqual({
      allowed: true,
      remaining: 0,
    });
    expect(checkRateLimit(key, 3, 60_000, t0 + 300)).toEqual({
      allowed: false,
      remaining: 0,
    });
    // After the 60s window expires, requests are allowed again.
    expect(checkRateLimit(key, 3, 60_000, t0 + 61_000)).toEqual({
      allowed: true,
      remaining: 2,
    });
  });
});
