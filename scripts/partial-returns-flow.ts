/**
 * Week 1 verification flow: successive partial returns against a running server.
 *
 *   npm run dev
 *   npx tsx scripts/partial-returns-flow.ts [baseUrl]
 *
 * Exercises registration by alias, guarantee creation (1000 USDC), acceptance,
 * on-chain create + fund, followed by two successive partial returns:
 *   1) Guarantor requests 350/0 -> Landlord counters 250/50 -> Guarantor accepts -> Execute
 *      (300 USDC paid out, 700 USDC remains locked, guarantee stays ACTIVE)
 *   2) Guarantor requests 300/0 -> Landlord accepts -> Execute
 *      (300 USDC paid out, 400 USDC remains locked, guarantee stays ACTIVE)
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
    guaranteeAmount: "1000",
    rentAmount: "850",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });
  step(`guarantee ${contract.reference} created`);

  await landlord.call(`/api/contracts/${contract.id}/accept`);
  step("landlord accepted the guarantee");

  const createOut = await guarantor.chainStep(contract.id, { step: "create" });
  step("guarantee registered on-chain", createOut.txHash);

  const fundOut = await guarantor.chainStep(contract.id, { step: "fund" });
  step("guarantee funded and locked (1000 USDC)", fundOut.txHash);

  // --- Partial Return #1 (negotiated 250 / 50 = 300 USDC out of 1000 USDC) ---
  const p1a = await guarantor.chainStep(contract.id, {
    step: "propose",
    propose: { toGuarantor: "350", toLandlord: "0", reason: "First partial release request" },
  });
  step("partial #1: guarantor proposed 350/0", p1a.txHash);

  const p1b = await landlord.chainStep(contract.id, {
    step: "propose",
    propose: {
      toGuarantor: "250",
      toLandlord: "50",
      reason: "Partial release with minor repair deduction",
    },
  });
  step("partial #1: landlord countered 250/50", p1b.txHash);

  const a1 = await guarantor.chainStep(contract.id, { step: "accept" });
  step("partial #1: guarantor accepted 250/50", a1.txHash);

  const e1 = await guarantor.chainStep(contract.id, { step: "execute" });
  step("partial #1: executed (300 USDC released, 700 USDC locked)", e1.txHash);

  let detail = await guarantor.call(`/api/contracts/${contract.id}`, undefined, "GET");
  if (detail.contract.status !== "ACTIVE") {
    throw new Error(`Expected ACTIVE after 1st partial return, got ${detail.contract.status}`);
  }
  if (Number(detail.guarantee.lockedAmount) !== 700) {
    throw new Error(`Expected 700 locked after 1st partial return, got ${detail.guarantee.lockedAmount}`);
  }

  const onChainId = BigInt(detail.guarantee.onChainId);
  if (!e1.simulated) {
    const onChainAfter1 = await readGuarantee(onChainId);
    console.log(
      `  -> On-chain after partial #1 (id ${onChainId}): state=${onChainAfter1?.state}, funded=${fromStroops(
        onChainAfter1?.funded ?? 0n,
      )} USDC, locked=${fromStroops(onChainAfter1?.locked ?? 0n)} USDC`,
    );
  }

  // --- Partial Return #2 (300 / 0 out of remaining 700 USDC) ---
  const p2 = await guarantor.chainStep(contract.id, {
    step: "propose",
    propose: { toGuarantor: "300", toLandlord: "0", reason: "Second partial release" },
  });
  step("partial #2: guarantor proposed 300/0", p2.txHash);

  const a2 = await landlord.chainStep(contract.id, { step: "accept" });
  step("partial #2: landlord accepted 300/0", a2.txHash);

  const e2 = await guarantor.chainStep(contract.id, { step: "execute" });
  step("partial #2: executed (300 USDC released, 400 USDC locked)", e2.txHash);

  detail = await guarantor.call(`/api/contracts/${contract.id}`, undefined, "GET");
  if (detail.contract.status !== "ACTIVE") {
    throw new Error(`Expected ACTIVE after 2nd partial return, got ${detail.contract.status}`);
  }
  if (Number(detail.guarantee.lockedAmount) !== 400) {
    throw new Error(`Expected 400 locked after 2nd partial return, got ${detail.guarantee.lockedAmount}`);
  }

  if (!e2.simulated) {
    const onChainAfter2 = await readGuarantee(onChainId);
    console.log(
      `  -> On-chain after partial #2 (id ${onChainId}): state=${onChainAfter2?.state}, funded=${fromStroops(
        onChainAfter2?.funded ?? 0n,
      )} USDC, locked=${fromStroops(onChainAfter2?.locked ?? 0n)} USDC`,
    );
  }

  console.log(
    `\nSuccessive partial returns completed for ${contract.reference} (on-chain id ${onChainId}). Remaining locked: ${formatLocked(
      detail.guarantee.lockedAmount,
    )} USDC.`,
  );
}

function formatLocked(val: string) {
  return Number(val).toFixed(2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
