/**
 * End-to-end walkthrough of the guarantee lifecycle against a running server.
 *
 *   npm run dev
 *   npx tsx scripts/demo-flow.ts [baseUrl]
 *
 * It exercises the same HTTP API the UI uses: registration by alias, a
 * guarantee sent by alias, landlord acceptance, funding, a return request, a
 * 300/700 proposal, a 150/850 counter, acceptance and execution.
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
  console.log(`✓ ${message}`);
}

async function main() {
  const suffix = randomBytes(4).toString("hex");
  const guarantor = new Client("guarantor");
  const landlord = new Client("landlord");

  const guarantorWallet = walletFor("DEMO_GUARANTOR_WALLET");
  const landlordWallet = walletFor("DEMO_LANDLORD_WALLET");

  await guarantor.call("/api/auth/register", {
    name: "Alice Guarantor",
    alias: `alice.${suffix}`,
    email: `alice+${suffix}@example.com`,
    password: "demo1234",
    stellarAddress: guarantorWallet,
  });
  await landlord.call("/api/auth/register", {
    name: "Bob Landlord",
    alias: `bob.${suffix}`,
    email: `bob+${suffix}@example.com`,
    password: "demo1234",
    stellarAddress: landlordWallet,
  });
  step("both parties registered");

  const { contract } = await guarantor.call("/api/contracts", {
    landlordAlias: `bob.${suffix}`,
    guarantorWallet,
    guaranteeAmount: "1000",
    rentAmount: "850",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });
  step(`guarantee ${contract.reference} created`);

  await landlord.call(`/api/contracts/${contract.id}/accept`);
  step("landlord accepted the guarantee");

  const chain = (client: Client, body: Record<string, unknown>) =>
    client.call(`/api/contracts/${contract.id}/chain`, body);

  await chain(guarantor, { step: "create" });
  await chain(guarantor, { step: "fund" });
  step("guarantee funded and locked");

  await chain(guarantor, {
    step: "propose",
    propose: { toGuarantor: "1000", toLandlord: "0", reason: "End of lease" },
  });
  step("guarantor requested the full deposit back");

  await chain(landlord, {
    step: "propose",
    propose: { toGuarantor: "700", toLandlord: "300", reason: "Damaged wall" },
  });
  step("landlord countered 700/300");

  await chain(guarantor, {
    step: "propose",
    propose: { toGuarantor: "850", toLandlord: "150", reason: "Partial wear" },
  });
  step("guarantor countered 850/150");

  await chain(landlord, { step: "accept" });
  step("landlord accepted the counter offer");

  await chain(guarantor, { step: "execute" });
  step("funds released");

  const detail = await guarantor.call(`/api/contracts/${contract.id}`, undefined, "GET");
  if (detail.contract.status !== "COMPLETED") {
    throw new Error(`Expected COMPLETED, got ${detail.contract.status}`);
  }
  const finalProposal = detail.proposals.find(
    (p: { status: string }) => p.status === "ACCEPTED",
  );
  console.log(
    `\nFinal split: ${finalProposal?.toGuarantor ?? "?"} USDC to the guarantor, ${
      finalProposal?.toLandlord ?? "?"
    } USDC to the landlord.`,
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
