import { randomBytes } from "node:crypto";

import { hash } from "bcryptjs";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Exercises the money-moving flows (partial returns, unilateral return,
 * extension, mandatory-reason rejection, edit/cancel before acceptance)
 * against a real Postgres database, the same way `scripts/demo-flow.ts` and
 * the manual verification during development did — but as part of the
 * suite, so a regression here fails `npm test` instead of needing someone
 * to remember to re-run a throwaway script.
 *
 * Skipped automatically when no database is reachable (e.g. a CI job that
 * only lints/typechecks). To run it locally: a local Postgres with the
 * migrations applied, then `npm test`.
 */

const WALLET_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const WALLET_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBN5FE";

let dbAvailable = true;
let db: (typeof import("@/lib/db"))["db"];
let schema: typeof import("@/lib/db/schema");
let contracts: typeof import("./contracts");
let chain: typeof import("./chain");

try {
  ({ db } = await import("@/lib/db"));
  schema = await import("@/lib/db/schema");
  contracts = await import("./contracts");
  chain = await import("./chain");
  await db.select().from(schema.users).limit(1);
} catch {
  dbAvailable = false;
}

async function makeUser(label: string) {
  const suffix = randomBytes(4).toString("hex");
  const [user] = await db!
    .insert(schema.users)
    .values({
      name: label,
      alias: `${label.toLowerCase()}.${suffix}`,
      email: `${label.toLowerCase()}+${suffix}@test.local`,
      passwordHash: await hash("test-password", 4),
      stellarAddress: label === "guarantor" ? WALLET_A : WALLET_B,
    })
    .returning();
  return user;
}

describe.skipIf(!dbAvailable)("settlement flows (integration)", () => {
  it("supports successive partial returns and a closing unilateral return", async () => {
    const guarantor = await makeUser("guarantor");
    const landlord = await makeUser("landlord");

    const created = await contracts.createRentalContract(guarantor, {
      landlordAlias: landlord.alias!,
      guarantorWallet: WALLET_A,
      guaranteeAmount: "1000",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    await contracts.acceptContract(landlord, created.id);
    await chain.startStep(guarantor, created.id, "create");
    await chain.startStep(guarantor, created.id, "fund");

    // Guarantor requests 300 back, landlord accepts, it executes.
    await chain.startStep(guarantor, created.id, "propose", {
      propose: { toGuarantor: "300", toLandlord: "0" },
    });
    await chain.startStep(landlord, created.id, "accept");
    await chain.startStep(guarantor, created.id, "execute");

    let detail = await contracts.getContractDetail(created.id, guarantor.id);
    expect(detail.contract.status).toBe("ACTIVE");
    expect(detail.guarantee?.lockedAmount).toBe("700.0000000");

    // Landlord returns 200 unilaterally — no negotiation needed.
    await chain.startStep(landlord, created.id, "return-unilateral", {
      returnUnilateral: { amount: "200" },
    });
    detail = await contracts.getContractDetail(created.id, guarantor.id);
    expect(detail.guarantee?.lockedAmount).toBe("500.0000000");
    expect(detail.contract.status).toBe("ACTIVE");

    // Landlord returns the remaining 500 — the guarantee closes.
    await chain.startStep(landlord, created.id, "return-unilateral", {
      returnUnilateral: { amount: "500" },
    });
    detail = await contracts.getContractDetail(created.id, guarantor.id);
    expect(detail.guarantee?.lockedAmount).toBe("0.0000000");
    expect(detail.contract.status).toBe("COMPLETED");
  });

  it("never lets a settlement exceed the locked balance", async () => {
    const guarantor = await makeUser("guarantor");
    const landlord = await makeUser("landlord");

    const created = await contracts.createRentalContract(guarantor, {
      landlordAlias: landlord.alias!,
      guarantorWallet: WALLET_A,
      guaranteeAmount: "1000",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    await contracts.acceptContract(landlord, created.id);
    await chain.startStep(guarantor, created.id, "create");
    await chain.startStep(guarantor, created.id, "fund");

    await expect(
      chain.startStep(guarantor, created.id, "propose", {
        propose: { toGuarantor: "600", toLandlord: "500" },
      }),
    ).rejects.toThrow();
  });

  it("requires a reason to reject a settlement proposal", async () => {
    const guarantor = await makeUser("guarantor");
    const landlord = await makeUser("landlord");

    const created = await contracts.createRentalContract(guarantor, {
      landlordAlias: landlord.alias!,
      guarantorWallet: WALLET_A,
      guaranteeAmount: "1000",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    await contracts.acceptContract(landlord, created.id);
    await chain.startStep(guarantor, created.id, "create");
    await chain.startStep(guarantor, created.id, "fund");
    await chain.startStep(guarantor, created.id, "propose", {
      propose: { toGuarantor: "500", toLandlord: "0" },
    });

    await expect(
      chain.startStep(landlord, created.id, "reject", { propose: { reason: "" } }),
    ).rejects.toThrow();

    await chain.startStep(landlord, created.id, "reject", {
      propose: { reason: "Not agreed on the amount" },
    });
    const detail = await contracts.getContractDetail(created.id, guarantor.id);
    expect(detail.contract.status).toBe("ACTIVE");
  });

  it("extends the guarantee up (top-up) and down (refund)", async () => {
    const guarantor = await makeUser("guarantor");
    const landlord = await makeUser("landlord");

    const created = await contracts.createRentalContract(guarantor, {
      landlordAlias: landlord.alias!,
      guarantorWallet: WALLET_A,
      guaranteeAmount: "1000",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    await contracts.acceptContract(landlord, created.id);
    await chain.startStep(guarantor, created.id, "create");
    await chain.startStep(guarantor, created.id, "fund");

    await chain.startStep(guarantor, created.id, "extend-propose", {
      extension: { newAmount: "1200", newEndDate: "2027-12-31" },
    });
    await chain.startStep(landlord, created.id, "extend-accept");
    let detail = await contracts.getContractDetail(created.id, guarantor.id);
    expect(detail.guarantee?.lockedAmount).toBe("1200.0000000");
    expect(detail.contract.status).toBe("ACTIVE");

    await chain.startStep(guarantor, created.id, "extend-propose", {
      extension: { newAmount: "800", newEndDate: "2028-12-31" },
    });
    await chain.startStep(landlord, created.id, "extend-accept");
    detail = await contracts.getContractDetail(created.id, guarantor.id);
    expect(detail.guarantee?.lockedAmount).toBe("800.0000000");
    expect(detail.contract.status).toBe("ACTIVE");
  });

  it("lets the guarantor edit or cancel a guarantee only before acceptance", async () => {
    const guarantor = await makeUser("guarantor");
    const landlord = await makeUser("landlord");

    const created = await contracts.createRentalContract(guarantor, {
      landlordAlias: landlord.alias!,
      guarantorWallet: WALLET_A,
      guaranteeAmount: "1000",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });

    await expect(
      contracts.updatePendingContract(landlord, created.id, {
        guaranteeAmount: "1",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      }),
    ).rejects.toThrow();

    const edited = await contracts.updatePendingContract(guarantor, created.id, {
      guaranteeAmount: "1500",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
    });
    expect(edited.guaranteeAmount).toBe("1500.0000000");

    const cancelled = await contracts.cancelPendingContract(guarantor, created.id);
    expect(cancelled.status).toBe("CANCELLED");

    await expect(contracts.acceptContract(landlord, created.id)).rejects.toThrow();
  });

  it("expires a guarantee left unaccepted for more than 30 days after its period starts", async () => {
    const guarantor = await makeUser("guarantor");
    const landlord = await makeUser("landlord");

    const created = await contracts.createRentalContract(guarantor, {
      landlordAlias: landlord.alias!,
      guarantorWallet: WALLET_A,
      guaranteeAmount: "1000",
      startDate: "2020-01-01",
      endDate: "2020-12-31",
    });

    const detail = await contracts.getContractForUser(created.id, guarantor.id);
    expect(detail.contract.status).toBe("CANCELLED");
  });

  it("charges the 0.05% fee only on what the guarantor receives", async () => {
    const guarantor = await makeUser("guarantor");
    const landlord = await makeUser("landlord");

    const created = await contracts.createRentalContract(guarantor, {
      landlordAlias: landlord.alias!,
      guarantorWallet: WALLET_A,
      guaranteeAmount: "1000",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    await contracts.acceptContract(landlord, created.id);
    await chain.startStep(guarantor, created.id, "create");
    await chain.startStep(guarantor, created.id, "fund");
    await chain.startStep(guarantor, created.id, "propose", {
      propose: { toGuarantor: "1000", toLandlord: "0" },
    });
    await chain.startStep(landlord, created.id, "accept");
    await chain.startStep(guarantor, created.id, "execute");

    const [agreement] = await db!
      .select()
      .from(schema.agreements)
      .where(eq(schema.agreements.contractId, created.id));
    expect(agreement.feeAmount).toBe("0.5000000");
  });
});
