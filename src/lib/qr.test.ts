import { describe, expect, it } from "vitest";

import { encodeQrMatrix } from "./qr";

describe("encodeQrMatrix", () => {
  it("generates a square matrix with finder patterns for Stellar Expert URLs", () => {
    const url =
      "https://stellar.expert/explorer/testnet/tx/82344efa3df6f588b770e6f3055497e4e50936d7fb27a079830e1989a83ecfc6";
    const matrix = encodeQrMatrix(url);
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix[0].length).toBe(matrix.length);
    // Top-left finder corners and center must be dark
    expect(matrix[0][0]).toBe(true);
    expect(matrix[0][6]).toBe(true);
    expect(matrix[6][0]).toBe(true);
    expect(matrix[3][3]).toBe(true);
    // Top-left finder inner ring (1,1) must be light
    expect(matrix[1][1]).toBe(false);
  });
});
