import { rpc } from "@stellar/stellar-sdk";

import { serverEnv } from "@/lib/env";

export const networkConfig = () => ({
  network: serverEnv.stellarNetwork(),
  rpcUrl: serverEnv.stellarRpcUrl(),
  horizonUrl: serverEnv.stellarHorizonUrl(),
  networkPassphrase: serverEnv.networkPassphrase(),
  usdcContractId: serverEnv.usdcSacId(),
  guaranteeContractId: serverEnv.sorobanContractId(),
});

let cached: rpc.Server | undefined;

export function rpcServer(): rpc.Server {
  if (!cached) {
    cached = new rpc.Server(serverEnv.stellarRpcUrl());
  }
  return cached;
}

export function explorerTxUrl(hash: string): string {
  const network = serverEnv.stellarNetwork();
  return `https://stellar.expert/explorer/${
    network === "public" ? "public" : "testnet"
  }/tx/${hash}`;
}

export function explorerAccountUrl(address: string): string {
  const network = serverEnv.stellarNetwork();
  return `https://stellar.expert/explorer/${
    network === "public" ? "public" : "testnet"
  }/account/${address}`;
}

export function shortenAddress(address: string, size = 4): string {
  if (address.length <= size * 2 + 3) return address;
  return `${address.slice(0, size + 1)}…${address.slice(-size)}`;
}

type HorizonBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
};

/**
 * The USDC balance of a Stellar account, read straight from Horizon.
 * Returns null when there is no USDC issuer configured (demo mode), the
 * account does not exist yet on the network, or it never added the USDC
 * trustline — all of those are normal in testnet/demo, not errors to show.
 */
export async function fetchUsdcBalance(address: string): Promise<string | null> {
  const issuer = serverEnv.usdcIssuer();
  if (!issuer) return null;

  try {
    const response = await fetch(
      `${serverEnv.stellarHorizonUrl()}/accounts/${address}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;

    const data = (await response.json()) as { balances?: HorizonBalance[] };
    const code = serverEnv.usdcCode();
    const entry = (data.balances ?? []).find(
      (balance) => balance.asset_code === code && balance.asset_issuer === issuer,
    );
    return entry?.balance ?? null;
  } catch {
    return null;
  }
}
