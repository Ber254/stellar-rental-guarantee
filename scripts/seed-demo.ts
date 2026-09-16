/**
 * Seeds two demo accounts and a rental contract ready to be funded so the
 * whole lifecycle can be walked through in the UI.
 *
 * Demo passwords are intentionally well known and this script must never be
 * run against a production database.
 */
import { randomBytes } from "node:crypto";

import { hash } from "bcryptjs";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { Keypair } from "@stellar/stellar-sdk";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { guarantees, properties, rentalContracts, users } = await import(
    "../src/lib/db/schema"
  );
  const { onChainIdFromReference } = await import(
    "../src/lib/stellar/guarantee-contract"
  );

  const password = await hash("demo1234", 10);
  const tenantWallet =
    process.env.DEMO_TENANT_WALLET ?? Keypair.random().publicKey();
  const landlordWallet =
    process.env.DEMO_LANDLORD_WALLET ?? Keypair.random().publicKey();

  async function upsertUser(name: string, email: string, wallet: string) {
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) return existing;
    const [created] = await db
      .insert(users)
      .values({ name, email, passwordHash: password, stellarAddress: wallet })
      .returning();
    return created;
  }

  const tenant = await upsertUser("Alice Tenant", "alice@example.com", tenantWallet);
  const landlord = await upsertUser("Bob Landlord", "bob@example.com", landlordWallet);

  const [property] = await db
    .insert(properties)
    .values({
      label: "Apartment 4B",
      address: "Calle Mayor 10, Madrid",
      createdBy: tenant.id,
    })
    .returning();

  const reference = `RG-${new Date().getFullYear()}-${String(
    Math.floor(Math.random() * 999999),
  ).padStart(6, "0")}`;

  const [contract] = await db
    .insert(rentalContracts)
    .values({
      reference,
      propertyId: property.id,
      tenantId: tenant.id,
      landlordId: landlord.id,
      landlordName: landlord.name,
      landlordEmail: landlord.email,
      tenantWallet,
      landlordWallet,
      guaranteeAmount: "1000.0000000",
      rentAmount: "850.0000000",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: "AWAITING_FUNDING",
      acceptedAt: new Date(),
      inviteToken: randomBytes(24).toString("base64url"),
    })
    .returning();

  await db.insert(guarantees).values({
    contractId: contract.id,
    amount: contract.guaranteeAmount,
    onChainId: onChainIdFromReference(reference).toString(),
  });

  console.log(`Demo contract ${reference} ready.`);
  console.log("Sign in as alice@example.com or bob@example.com (password: demo1234)");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
