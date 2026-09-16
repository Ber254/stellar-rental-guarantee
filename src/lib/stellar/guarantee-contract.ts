import {
  Address,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

import { serverEnv } from "@/lib/env";
import { networkConfig, rpcServer } from "./network";

const BASE_FEE = "1000000"; // 0.1 XLM cap; the RPC refunds the unused resource fee.
const TIMEOUT_SECONDS = 120;

export const STATES = [
  "Created",
  "Funded",
  "ReturnRequested",
  "Negotiation",
  "Agreed",
  "Released",
  "Cancelled",
] as const;

export type GuaranteeState = (typeof STATES)[number];

export type OnChainGuarantee = {
  tenant: string;
  landlord: string;
  token: string;
  amount: bigint;
  endDate: bigint;
  state: GuaranteeState;
};

const guaranteeContract = () => {
  const { guaranteeContractId } = networkConfig();
  if (!guaranteeContractId) {
    throw new Error("SOROBAN_CONTRACT_ID is not configured");
  }
  return new Contract(guaranteeContractId);
};

const u64 = (value: bigint | number) =>
  nativeToScVal(BigInt(value), { type: "u64" });
const i128 = (value: bigint) => nativeToScVal(value, { type: "i128" });
const addr = (value: string) => new Address(value).toScVal();

type CallName =
  | "create_guarantee"
  | "fund_guarantee"
  | "request_release"
  | "propose_distribution"
  | "accept_proposal"
  | "release_funds"
  | "cancel_guarantee";

export type ContractCall = { method: CallName; args: xdr.ScVal[] };

export const calls = {
  createGuarantee: (params: {
    id: bigint;
    tenant: string;
    landlord: string;
    amount: bigint;
    endDate: bigint;
  }): ContractCall => ({
    method: "create_guarantee",
    args: [
      u64(params.id),
      addr(params.tenant),
      addr(params.landlord),
      addr(requireUsdcContractId()),
      i128(params.amount),
      u64(params.endDate),
    ],
  }),
  fundGuarantee: (id: bigint): ContractCall => ({
    method: "fund_guarantee",
    args: [u64(id)],
  }),
  requestRelease: (id: bigint, caller: string): ContractCall => ({
    method: "request_release",
    args: [u64(id), addr(caller)],
  }),
  proposeDistribution: (params: {
    id: bigint;
    proposer: string;
    toLandlord: bigint;
    toTenant: bigint;
  }): ContractCall => ({
    method: "propose_distribution",
    args: [
      u64(params.id),
      addr(params.proposer),
      i128(params.toLandlord),
      i128(params.toTenant),
    ],
  }),
  acceptProposal: (id: bigint, acceptor: string): ContractCall => ({
    method: "accept_proposal",
    args: [u64(id), addr(acceptor)],
  }),
  releaseFunds: (id: bigint): ContractCall => ({
    method: "release_funds",
    args: [u64(id)],
  }),
  cancelGuarantee: (id: bigint, caller: string): ContractCall => ({
    method: "cancel_guarantee",
    args: [u64(id), addr(caller)],
  }),
};

function requireUsdcContractId(): string {
  const { usdcContractId } = networkConfig();
  if (!usdcContractId) {
    throw new Error("STELLAR_USDC_CONTRACT_ID is not configured");
  }
  return usdcContractId;
}

/** Builds and simulates a call, returning the XDR the source account must sign. */
export async function buildCallXdr(
  sourceAddress: string,
  call: ContractCall,
): Promise<string> {
  const server = rpcServer();
  const account = await server.getAccount(sourceAddress);
  const contract = guaranteeContract();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkConfig().networkPassphrase,
  })
    .addOperation(contract.call(call.method, ...call.args))
    .setTimeout(TIMEOUT_SECONDS)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

/**
 * A signed transaction arrives from the browser, so it is only trusted after
 * checking that it invokes the escrow function the server planned, with the
 * exact arguments it planned, and nothing else.
 */
export function assertMatchesCall(signedXdr: string, call: ContractCall) {
  const tx = TransactionBuilder.fromXDR(
    signedXdr,
    networkConfig().networkPassphrase,
  ) as Transaction;

  const envelope = tx.toEnvelope();
  if (envelope.type !== "envelopeTypeTx") {
    throw new Error("Unsupported transaction envelope");
  }

  const operations = envelope.v1.tx.operations;
  if (operations.length !== 1) {
    throw new Error("The signed transaction must contain a single operation");
  }

  const body = operations[0].body;
  if (body.type !== "invokeHostFunction") {
    throw new Error("The signed transaction is not a contract invocation");
  }
  const hostFunction = body.invokeHostFunctionOp.hostFunction;
  if (hostFunction.type !== "hostFunctionTypeInvokeContract") {
    throw new Error("The signed transaction is not a contract invocation");
  }

  const invocation = hostFunction.invokeContract;
  const contractId = Address.fromScAddress(invocation.contractAddress).toString();
  if (contractId !== networkConfig().guaranteeContractId) {
    throw new Error("The signed transaction targets another contract");
  }
  if (invocation.functionName.toString() !== call.method) {
    throw new Error("The signed transaction calls another function");
  }

  const args = invocation.args;
  const matches =
    args.length === call.args.length &&
    args.every(
      (arg, index) => arg.toXdr("base64") === call.args[index].toXdr("base64"),
    );
  if (!matches) {
    throw new Error("The signed transaction has unexpected arguments");
  }
}

export type SubmitResult = {
  hash: string;
  ledger?: number;
  returnValue?: unknown;
};

/** Submits an already signed transaction and waits for it to be applied. */
export async function submitSignedXdr(signedXdr: string): Promise<SubmitResult> {
  const server = rpcServer();
  const tx = TransactionBuilder.fromXDR(
    signedXdr,
    networkConfig().networkPassphrase,
  ) as Transaction;

  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(
      `Stellar rejected the transaction: ${JSON.stringify(sent.errorResult)}`,
    );
  }

  const result = await server.pollTransaction(sent.hash, {
    attempts: 30,
    sleepStrategy: () => 1000,
  });

  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(
      `Transaction ${sent.hash} failed on Stellar (status: ${result.status})`,
    );
  }

  return {
    hash: sent.hash,
    ledger: result.ledger,
    returnValue: result.returnValue
      ? scValToNative(result.returnValue)
      : undefined,
  };
}

/** Signs with a server-held key. Only used by the platform account and demo mode. */
export async function signAndSubmit(
  secretKey: string,
  call: ContractCall,
): Promise<SubmitResult> {
  const keypair = Keypair.fromSecret(secretKey);
  const xdrToSign = await buildCallXdr(keypair.publicKey(), call);
  const tx = TransactionBuilder.fromXDR(
    xdrToSign,
    networkConfig().networkPassphrase,
  ) as Transaction;
  tx.sign(keypair);
  return submitSignedXdr(tx.toXDR());
}

export async function platformSignAndSubmit(
  call: ContractCall,
): Promise<SubmitResult> {
  const secret = serverEnv.platformSecretKey();
  if (!secret) throw new Error("PLATFORM_SECRET_KEY is not configured");
  return signAndSubmit(secret, call);
}

export async function readGuarantee(
  id: bigint,
): Promise<OnChainGuarantee | null> {
  const server = rpcServer();
  const contract = guaranteeContract();

  // Simulated reads need a source account; the platform account is fine because
  // nothing is signed or submitted.
  const secret = serverEnv.platformSecretKey();
  if (!secret) throw new Error("PLATFORM_SECRET_KEY is not configured");
  const reader = Keypair.fromSecret(secret);
  const account = await server.getAccount(reader.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkConfig().networkPassphrase,
  })
    .addOperation(contract.call("get_guarantee", u64(id)))
    .setTimeout(TIMEOUT_SECONDS)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) return null;
  if (!sim.result?.retval) return null;

  const raw = scValToNative(sim.result.retval) as {
    tenant: string;
    landlord: string;
    token: string;
    amount: bigint;
    end_date: bigint;
    state: number;
  };

  return {
    tenant: raw.tenant,
    landlord: raw.landlord,
    token: raw.token,
    amount: BigInt(raw.amount),
    endDate: BigInt(raw.end_date),
    state: STATES[raw.state] ?? "Created",
  };
}

/** RG-2026-000001 -> 2026000001 */
export function onChainIdFromReference(reference: string): bigint {
  const match = /^RG-(\d{4})-(\d{6})$/.exec(reference);
  if (!match) throw new Error(`Invalid contract reference: ${reference}`);
  return BigInt(`${match[1]}${match[2]}`);
}
