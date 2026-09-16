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
