/**
 * Seeds two demo accounts and a guarantee ready to be funded so the whole
 * lifecycle can be walked through in the UI.
 *
 * Demo passwords are intentionally well known and this script must never be
 * run against a production database.
 */
import { hash } from "bcryptjs";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { Keypair } from "@stellar/stellar-sdk";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { guarantees, rentalContracts, users } = await import("../src/lib/db/schema");
  const { onChainIdFromReference } = await import(
    "../src/lib/stellar/guarantee-contract"
  );

  const password = await hash("demo1234", 10);
  const guarantorWallet =
    process.env.DEMO_GUARANTOR_WALLET ?? Keypair.random().publicKey();
  const landlordWallet =
    process.env.DEMO_LANDLORD_WALLET ?? Keypair.random().publicKey();

  async function upsertUser(
    name: string,
    alias: string,
    email: string,
    wallet: string,
  ) {
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) return existing;
    const [created] = await db
      .insert(users)
      .values({ name, alias, email, passwordHash: password, stellarAddress: wallet })
      .returning();
    return created;
  }

  const guarantor = await upsertUser(
    "Alice Guarantor",
    "alice.guarantor",
    "alice@example.com",
    guarantorWallet,
  );
  const landlord = await upsertUser(
    "Bob Landlord",
    "bob.landlord",
    "bob@example.com",
    landlordWallet,
  );

  const reference = `SFX-${new Date().getFullYear()}-${String(
    Math.floor(Math.random() * 999999),
  ).padStart(6, "0")}`;

  const [contract] = await db
    .insert(rentalContracts)
    .values({
      reference,
      guarantorId: guarantor.id,
      landlordId: landlord.id,
      guarantorWallet,
      landlordWallet,
      guaranteeAmount: "1000.0000000",
      rentAmount: "850.0000000",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: "AWAITING_FUNDING",
      acceptedAt: new Date(),
      inviteToken: reference,
    })
    .returning();

  await db.insert(guarantees).values({
    contractId: contract.id,
    amount: contract.guaranteeAmount,
    onChainId: onChainIdFromReference(reference).toString(),
  });

  console.log(`Demo guarantee ${reference} ready.`);
  console.log("Sign in as alice@example.com or bob@example.com (password: demo1234)");
  console.log("Aliases: @alice.guarantor and @bob.landlord");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
