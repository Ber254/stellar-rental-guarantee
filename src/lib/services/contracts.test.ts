import { describe, expect, it } from "vitest";

// The db client is built at import time; tests only exercise pure helpers.
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/test";

const { createContractSchema, roleOf } = await import("./contracts");

const tenantWallet = "GCKMGALLPD64ZMCQBQIO36AZGKMN3MC4A7KK6Q6SEDYGWLZNJGTYR4PX";
const landlordWallet = "GCK2VCWIM74HGMQ7CMXNLJBJKUA5EL62IQFVLR4CXZ35TJOILK2XO6D2";

const valid = {
  propertyLabel: "Apartment 4B",
  propertyAddress: "Calle Mayor 10, Madrid",
  landlordName: "Bob Landlord",
  landlordEmail: "bob@example.com",
  tenantWallet,
  landlordWallet,
  guaranteeAmount: "1000",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
};

describe("createContractSchema", () => {
  it("accepts a well formed contract", () => {
    expect(createContractSchema.parse(valid).guaranteeAmount).toBe("1000");
  });

  it("rejects wallets that are not Stellar addresses", () => {
    expect(() =>
      createContractSchema.parse({ ...valid, tenantWallet: "0xabc" }),
    ).toThrow();
  });

  it("rejects the same wallet for both parties", () => {
    expect(() =>
      createContractSchema.parse({ ...valid, landlordWallet: tenantWallet }),
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
  const contract = { tenantId: "t-1", landlordId: "l-1" };

  it("resolves both parties", () => {
    expect(roleOf(contract as never, "t-1")).toBe("TENANT");
    expect(roleOf(contract as never, "l-1")).toBe("LANDLORD");
  });

  it("rejects anybody else", () => {
    expect(() => roleOf(contract as never, "x-1")).toThrow();
  });
});
