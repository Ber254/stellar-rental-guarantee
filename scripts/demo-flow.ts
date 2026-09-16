/**
 * End-to-end walkthrough of the guarantee lifecycle against a running server.
 *
 *   npm run dev
 *   npx tsx scripts/demo-flow.ts [baseUrl]
 *
 * It exercises the same HTTP API the UI uses: contract creation, landlord
 * acceptance, funding, return request, a 300/700 proposal, a 150/850 counter,
 * acceptance and release.
 */
import { randomBytes } from "node:crypto";

import { Keypair } from "@stellar/stellar-sdk";

const baseUrl = process.argv[2] ?? "http://localhost:3000";

class Client {
  private cookie = "";

  constructor(readonly label: string) {}

  async call(path: string, body?: unknown, method = "POST") {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        `${this.label} ${method} ${path} -> ${response.status}: ${
          payload.error ?? "unknown error"
        }`,
      );
    }
    return payload;
  }
}

/**
 * Testnet runs need wallets that hold USDC and whose keys the server can sign
 * with; a simulated run works with any address.
 */
function walletFor(name: string): string {
  return process.env[name] ?? Keypair.random().publicKey();
}

function step(message: string) {
  console.log(`\u2713 ${message}`);
}

async function main() {
  const suffix = randomBytes(4).toString("hex");
  const tenant = new Client("tenant");
  const landlord = new Client("landlord");

  await tenant.call("/api/auth/register", {
    name: "Alice Tenant",
    email: `alice+${suffix}@example.com`,
    password: "demo1234",
  });
  await landlord.call("/api/auth/register", {
    name: "Bob Landlord",
    email: `bob+${suffix}@example.com`,
    password: "demo1234",
  });
  step("both parties registered");

  const { contract } = await tenant.call("/api/contracts", {
    propertyLabel: "Apartment 4B",
    propertyAddress: "Calle Mayor 10, Madrid",
    landlordName: "Bob Landlord",
    landlordEmail: `bob+${suffix}@example.com`,
    tenantWallet: walletFor("DEMO_TENANT_WALLET"),
    landlordWallet: walletFor("DEMO_LANDLORD_WALLET"),
    guaranteeAmount: "1000",
    rentAmount: "850",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });
  step(`contract ${contract.reference} created`);

  await landlord.call(`/api/invites/${contract.inviteToken}`);
  step("landlord accepted the contract");

  const chain = (client: Client, body: Record<string, unknown>) =>
    client.call(`/api/contracts/${contract.id}/chain`, body);

  await chain(tenant, { step: "create" });
  await chain(tenant, { step: "fund" });
  step("guarantee funded and locked");

  await chain(tenant, { step: "request-release" });
  step("tenant requested the deposit back");

  await chain(landlord, {
    step: "propose",
    propose: { toLandlord: "300", toTenant: "700", reason: "Damaged wall" },
  });
  step("landlord proposed 300/700");

  await chain(tenant, {
    step: "propose",
    propose: { toLandlord: "150", toTenant: "850", reason: "Partial wear" },
  });
  step("tenant countered 150/850");

  await chain(landlord, { step: "accept" });
  step("landlord accepted the counter offer");

  await chain(tenant, { step: "release" });
  step("funds released");

  const detail = await tenant.call(`/api/contracts/${contract.id}`, undefined, "GET");
  if (detail.contract.status !== "COMPLETED") {
    throw new Error(`Expected COMPLETED, got ${detail.contract.status}`);
  }
  console.log(
    `\nFinal split: ${detail.agreement.toLandlord} USDC to the landlord, ${detail.agreement.toTenant} USDC to the tenant.`,
  );
  console.log(
    detail.transactions.some((tx: { simulated: boolean }) => !tx.simulated)
      ? "Submitted on Stellar testnet."
      : "Simulated run (no Soroban contract configured).",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
