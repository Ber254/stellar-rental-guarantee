import { Keypair } from "@stellar/stellar-sdk";

/**
 * Demo mode only. `DEMO_SIGNER_SECRETS` holds comma separated *testnet* secret
 * keys for the throwaway Alice/Bob accounts so the whole lifecycle can be
 * demonstrated without a browser wallet.
 *
 * Real users always sign in their own wallet: no user key is ever stored by
 * this application, and this map is empty unless the operator opts in.
 */
let cache: Map<string, string> | undefined;

function signers(): Map<string, string> {
  if (cache) return cache;
  cache = new Map();
  const raw = process.env.DEMO_SIGNER_SECRETS;
  if (!raw) return cache;
  for (const secret of raw.split(",").map((value) => value.trim())) {
    if (!secret) continue;
    try {
      cache.set(Keypair.fromSecret(secret).publicKey(), secret);
    } catch {
      // Ignore malformed entries rather than breaking every request.
    }
  }
  return cache;
}

export function demoSecretFor(publicKey: string): string | undefined {
  return signers().get(publicKey);
}

export function demoSignersConfigured(): boolean {
  return signers().size > 0;
}
