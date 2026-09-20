import { describe, expect, it } from "vitest";

// The db client is built at import time; tests only exercise pure helpers.
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/test";

const { createContractSchema, roleOf } = await import("./contracts");

const guarantorWallet = "GCKMGALLPD64ZMCQBQIO36AZGKMN3MC4A7KK6Q6SEDYGWLZNJGTYR4PX";

const valid = {
  landlordAlias: "bob.landlord",
  propertyLabel: "Apartment 4B",
  propertyAddress: "Calle Mayor 10, Madrid",
  guarantorWallet,
  guaranteeAmount: "1000",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
};

describe("createContractSchema", () => {
  it("accepts a well formed guarantee", () => {
    expect(createContractSchema.parse(valid).guaranteeAmount).toBe("1000");
  });

  it("accepts a guarantee with no property", () => {
    const { propertyLabel, propertyAddress, ...rest } = valid;
    void propertyLabel;
    void propertyAddress;
    expect(createContractSchema.parse(rest).guaranteeAmount).toBe("1000");
  });

  it("rejects wallets that are not Stellar addresses", () => {
    expect(() =>
      createContractSchema.parse({ ...valid, guarantorWallet: "0xabc" }),
    ).toThrow();
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      createContractSchema.parse({ ...valid, endDate: "2025-01-01" }),
    ).toThrow();
  });

  it("rejects zero, negative and over-precise amounts", () => {
    for (const guaranteeAmount of ["0", "-10", "10.12345678"]) {
      expect(() =>
        createContractSchema.parse({ ...valid, guaranteeAmount }),
      ).toThrow();
    }
  });
});

describe("roleOf", () => {
  const contract = { guarantorId: "g-1", landlordId: "l-1" };

  it("resolves both parties", () => {
    expect(roleOf(contract as never, "g-1")).toBe("GUARANTOR");
    expect(roleOf(contract as never, "l-1")).toBe("LANDLORD");
  });

  it("rejects anybody else", () => {
    expect(() => roleOf(contract as never, "x-1")).toThrow();
  });
});
