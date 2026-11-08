/**
 * Week 2 verification flow: landlord's unilateral return and extensions
 * (amount increase followed by amount decrease) against a running server.
 *
 *   npm run dev
 *   npx tsx scripts/unilateral-and-extensions-flow.ts [baseUrl]
 *
 * Exercises:
 *   1) Registration by alias, guarantee creation (600 USDC), acceptance, on-chain create + fund
 *   2) Landlord unilateral partial return of 200 USDC -> 400 USDC remains locked (Active)
 *   3) Extension with amount increase: 400 -> 700 USDC (+300 USDC top-up), new end date 2027-06-30
 *      -> landlord accepts -> funded=900 USDC, locked=700 USDC (Active)
 *   4) Extension with amount decrease: 700 -> 500 USDC (-200 USDC refunded net of 0.05% fee),
 *      new end date 2027-12-31 -> landlord accepts -> funded=900 USDC, locked=500 USDC (Active)
 *   5) Closing landlord unilateral return of remaining 500 USDC -> locked=0 USDC (Closed)
 */
import { randomBytes } from "node:crypto";

import { config } from "dotenv";
import { Keypair, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

import { fromStroops } from "../src/lib/money";
import { readGuarantee } from "../src/lib/stellar/guarantee-contract";
import { networkConfig } from "../src/lib/stellar/network";

config({ path: ".env.local" });
config({ path: ".env" });

const baseUrl = process.argv[2] ?? "http://localhost:3000";

class Client {
  private cookie = "";

  constructor(
    readonly label: string,
    readonly keypair?: Keypair,
  ) {}

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

  async chainStep(contractId: string, body: Record<string, unknown>) {
    let outcome = await this.call(`/api/contracts/${contractId}/chain`, body);
    if (outcome.mode === "sign") {
      if (!this.keypair) {
        throw new Error(`Step ${body.step} requires a signature for ${this.label}`);
      }
      const tx = TransactionBuilder.fromXDR(
        outcome.xdr,
        networkConfig().networkPassphrase,
      ) as Transaction;
      tx.sign(this.keypair);
      outcome = await this.call(`/api/contracts/${contractId}/chain`, {
        ...body,
        signedXdr: tx.toXDR(),
      });
    }
    return outcome;
  }
}

function resolveParty(envWallet: string, secret?: string): { wallet: string; keypair?: Keypair } {
  if (secret) {
    const kp = Keypair.fromSecret(secret);
    return { wallet: kp.publicKey(), keypair: kp };
  }
  const configured = process.env[envWallet];
  if (configured) return { wallet: configured };
  const kp = Keypair.random();
  return { wallet: kp.publicKey(), keypair: kp };
}

function step(message: string, txHash?: string | null) {
  console.log(`✓ ${message}${txHash ? ` (${txHash})` : ""}`);
}

async function logOnChain(label: string, onChainId: bigint, simulated: boolean) {
  if (simulated) return;
  const g = await readGuarantee(onChainId);
  console.log(
    `  -> On-chain ${label} (id ${onChainId}): state=${g?.state}, funded=${fromStroops(
      g?.funded ?? 0n,
    )} USDC, locked=${fromStroops(g?.locked ?? 0n)} USDC, endDate=${g?.endDate}`,
  );
}

async function main() {
  const suffix = randomBytes(4).toString("hex");
  const rawSecrets = (process.env.DEMO_SIGNER_SECRETS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const guarantorParty = resolveParty("DEMO_GUARANTOR_WALLET", rawSecrets[0]);
  const landlordParty = resolveParty("DEMO_LANDLORD_WALLET", rawSecrets[1]);

  const guarantor = new Client("guarantor", guarantorParty.keypair);
  const landlord = new Client("landlord", landlordParty.keypair);

  await guarantor.call("/api/auth/register", {
    name: "Alice Guarantor",
    alias: `alice.${suffix}`,
    email: `alice+${suffix}@example.com`,
    password: "demo1234",
    stellarAddress: guarantorParty.wallet,
  });
  await landlord.call("/api/auth/register", {
    name: "Bob Landlord",
    alias: `bob.${suffix}`,
    email: `bob+${suffix}@example.com`,
    password: "demo1234",
    stellarAddress: landlordParty.wallet,
  });
  step("both parties registered");

  const { contract } = await guarantor.call("/api/contracts", {
    landlordAlias: `bob.${suffix}`,
    guarantorWallet: guarantorParty.wallet,
    guaranteeAmount: "600",
    rentAmount: "500",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });
  step(`guarantee ${contract.reference} created`);

  await landlord.call(`/api/contracts/${contract.id}/accept`);
  step("landlord accepted the guarantee");

  const createOut = await guarantor.chainStep(contract.id, { step: "create" });
  step("guarantee registered on-chain", createOut.txHash);

  const fundOut = await guarantor.chainStep(contract.id, { step: "fund" });
  step("guarantee funded and locked (600 USDC)", fundOut.txHash);

  let detail = await guarantor.call(`/api/contracts/${contract.id}`, undefined, "GET");
  const onChainId = BigInt(detail.guarantee.onChainId);
  await logOnChain("after fund", onChainId, fundOut.simulated);

  // --- Mechanic 1: Landlord unilateral return (partial: 200 USDC) ---
  const u1 = await landlord.chainStep(contract.id, {
    step: "return-unilateral",
    returnUnilateral: { amount: "200" },
  });
  step("unilateral return #1: landlord returned 200 USDC (400 USDC locked)", u1.txHash);
  await logOnChain("after unilateral return #1", onChainId, u1.simulated);

  detail = await guarantor.call(`/api/contracts/${contract.id}`, undefined, "GET");
  if (detail.contract.status !== "ACTIVE" || Number(detail.guarantee.lockedAmount) !== 400) {
    throw new Error(
      `Expected ACTIVE with 400 locked after unilateral #1, got ${detail.contract.status} / ${detail.guarantee.lockedAmount}`,
    );
  }

  // --- Mechanic 2: Extension with amount increase (400 -> 700 USDC, +300 top-up) ---
  const extUpPropose = await guarantor.chainStep(contract.id, {
    step: "extend-propose",
    extension: { newAmount: "700", newEndDate: "2027-06-30" },
  });
  step("extension (increase): guarantor proposed 700 USDC (+300 top-up) until 2027-06-30", extUpPropose.txHash);

  const extUpAccept = await landlord.chainStep(contract.id, { step: "extend-accept" });
  step("extension (increase): landlord accepted (700 USDC locked, 900 USDC funded)", extUpAccept.txHash);
  await logOnChain("after extension increase", onChainId, extUpAccept.simulated);

  detail = await guarantor.call(`/api/contracts/${contract.id}`, undefined, "GET");
  if (detail.contract.status !== "ACTIVE" || Number(detail.guarantee.lockedAmount) !== 700) {
    throw new Error(
      `Expected ACTIVE with 700 locked after extension increase, got ${detail.contract.status} / ${detail.guarantee.lockedAmount}`,
    );
  }

  // --- Mechanic 3: Extension with amount decrease (700 -> 500 USDC, -200 refund) ---
  const extDownPropose = await guarantor.chainStep(contract.id, {
    step: "extend-propose",
    extension: { newAmount: "500", newEndDate: "2027-12-31" },
  });
  step("extension (decrease): guarantor proposed 500 USDC (-200 refund) until 2027-12-31", extDownPropose.txHash);

  const extDownAccept = await landlord.chainStep(contract.id, { step: "extend-accept" });
  step("extension (decrease): landlord accepted (500 USDC locked, 200 USDC refunded)", extDownAccept.txHash);
  await logOnChain("after extension decrease", onChainId, extDownAccept.simulated);

  detail = await guarantor.call(`/api/contracts/${contract.id}`, undefined, "GET");
  if (detail.contract.status !== "ACTIVE" || Number(detail.guarantee.lockedAmount) !== 500) {
    throw new Error(
      `Expected ACTIVE with 500 locked after extension decrease, got ${detail.contract.status} / ${detail.guarantee.lockedAmount}`,
    );
  }

  // --- Mechanic 4: Closing landlord unilateral return (remaining 500 USDC) ---
  const u2 = await landlord.chainStep(contract.id, {
    step: "return-unilateral",
    returnUnilateral: { amount: "500" },
  });
  step("unilateral return #2: landlord returned remaining 500 USDC (Closed)", u2.txHash);
  await logOnChain("after closing unilateral return", onChainId, u2.simulated);

  detail = await guarantor.call(`/api/contracts/${contract.id}`, undefined, "GET");
  if (detail.contract.status !== "COMPLETED" || Number(detail.guarantee.lockedAmount) !== 0) {
    throw new Error(
      `Expected COMPLETED with 0 locked after closing return, got ${detail.contract.status} / ${detail.guarantee.lockedAmount}`,
    );
  }

  console.log(
    `\nUnilateral return + extensions (increase & decrease) completed for ${contract.reference} (on-chain id ${onChainId}).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
