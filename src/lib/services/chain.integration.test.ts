import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * End-to-end coverage of the money-moving flows against a real Postgres, in
 * simulated chain mode. Set TEST_DATABASE_URL to a database where
 * `npm run db:migrate` has already run:
 *
 *   createdb safexy_test
 *   DATABASE_URL=postgres://.../safexy_test npm run db:migrate
 *   TEST_DATABASE_URL=postgres://.../safexy_test npm test
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("guarantee lifecycle (real database, simulated chain)", () => {
  process.env.DATABASE_URL = url ?? "";
  delete process.env.SOROBAN_CONTRACT_ID;

  let db: typeof import("@/lib/db").db;
  let schema: typeof import("@/lib/db/schema");
  let contracts: typeof import("./contracts");
  let chain: typeof import("./chain");

  const wallets = {
    guarantor: "GCKMGALLPD64ZMCQBQIO36AZGKMN3MC4A7KK6Q6SEDYGWLZNJGTYR4PX",
    landlord: "GCK2VCWIM74HGMQ7CMXNLJBJKUA5EL62IQFVLR4CXZ35TJOILK2XO6D2",
  };

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    contracts = await import("./contracts");
    chain = await import("./chain");
  });

  async function createUser(role: "guarantor" | "landlord") {
    const suffix = randomUUID().slice(0, 8);
    const [user] = await db
      .insert(schema.users)
      .values({
        email: `${role}.${suffix}@example.test`,
        name: role === "guarantor" ? "Ana" : "Beto",
        alias: `${role}.${suffix}`,
        passwordHash: "x",
        stellarAddress: wallets[role],
      })
      .returning();
    return user;
  }

  /** A funded guarantee of `amount` USDC, ready for returns and extensions. */
  async function fundedGuarantee(amount: string) {
    const guarantor = await createUser("guarantor");
    const landlord = await createUser("landlord");
    const contract = await contracts.createRentalContract(guarantor, {
      landlordAlias: landlord.alias!,
      guarantorWallet: wallets.guarantor,
      guaranteeAmount: amount,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    await contracts.acceptContract(landlord, contract.id);
    await chain.startStep(guarantor, contract.id, "create");
    await chain.startStep(guarantor, contract.id, "fund");
    return { guarantor, landlord, contractId: contract.id };
  }

  async function state(contractId: string) {
    const [contract] = await db
      .select()
      .from(schema.rentalContracts)
      .where(eq(schema.rentalContracts.id, contractId));
    const [guarantee] = await db
      .select()
      .from(schema.guarantees)
      .where(eq(schema.guarantees.contractId, contractId));
    return { status: contract.status, locked: guarantee.lockedAmount };
  }

  it("keeps the remainder locked across successive partial returns", async () => {
    const { guarantor, landlord, contractId } = await fundedGuarantee("1000");
    expect(await state(contractId)).toMatchObject({ status: "ACTIVE" });

    for (const back of ["300", "200"]) {
      await chain.startStep(guarantor, contractId, "propose", {
        propose: { toGuarantor: back, toLandlord: "0" },
      });
      await chain.startStep(landlord, contractId, "accept");
      await chain.startStep(guarantor, contractId, "execute");
    }

    const after = await state(contractId);
    expect(Number(after.locked)).toBe(500);
    expect(after.status).toBe("ACTIVE");
  });

  it("closes the guarantee when the landlord returns the rest unilaterally", async () => {
    const { guarantor, landlord, contractId } = await fundedGuarantee("400");
    await chain.startStep(landlord, contractId, "return-unilateral", {
      returnUnilateral: { amount: "150" },
    });
    expect(Number((await state(contractId)).locked)).toBe(250);

    await chain.startStep(landlord, contractId, "return-unilateral", {
      returnUnilateral: { amount: "250" },
    });
    const closed = await state(contractId);
    expect(Number(closed.locked)).toBe(0);
    expect(closed.status).toBe("COMPLETED");
    void guarantor;
  });

  it("rejects a return larger than the locked balance", async () => {
    const { landlord, contractId } = await fundedGuarantee("100");
    await expect(
      chain.startStep(landlord, contractId, "return-unilateral", {
        returnUnilateral: { amount: "100.0000001" },
      }),
    ).rejects.toThrow();
  });

  it("grows the locked amount on an extension and shrinks it back", async () => {
    const { guarantor, landlord, contractId } = await fundedGuarantee("1000");

    await chain.startStep(guarantor, contractId, "extend-propose", {
      extension: { newEndDate: "2027-06-30", newAmount: "1500" },
    });
    await chain.startStep(landlord, contractId, "extend-accept");
    expect(Number((await state(contractId)).locked)).toBe(1500);

    await chain.startStep(guarantor, contractId, "extend-propose", {
      extension: { newEndDate: "2027-12-31", newAmount: "900" },
    });
    await chain.startStep(landlord, contractId, "extend-accept");
    const after = await state(contractId);
    expect(Number(after.locked)).toBe(900);
    expect(after.status).toBe("ACTIVE");
  });

  it("only lets the landlord return unilaterally and the guarantor extend", async () => {
    const { guarantor, landlord, contractId } = await fundedGuarantee("500");
    await expect(
      chain.startStep(guarantor, contractId, "return-unilateral", {
        returnUnilateral: { amount: "10" },
      }),
    ).rejects.toThrow();
    await expect(
      chain.startStep(landlord, contractId, "extend-propose", {
        extension: { newEndDate: "2027-01-31", newAmount: "600" },
      }),
    ).rejects.toThrow();
  });

  it("records a localizable notification for every step", async () => {
    const { guarantor, landlord, contractId } = await fundedGuarantee("200");
    await chain.startStep(landlord, contractId, "return-unilateral", {
      returnUnilateral: { amount: "200" },
    });
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.contractId, contractId));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.template).toBeTruthy();
      expect(row.params).toBeTruthy();
    }
    void guarantor;
  });
});
