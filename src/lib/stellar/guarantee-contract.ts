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

export const STATES = ["Pending", "Active", "Closed", "Cancelled"] as const;

export type GuaranteeState = (typeof STATES)[number];

export type OnChainGuarantee = {
  guarantor: string;
  landlord: string;
  token: string;
  locked: bigint;
  funded: bigint;
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
const u32 = (value: number) => nativeToScVal(value, { type: "u32" });
const i128 = (value: bigint) => nativeToScVal(value, { type: "i128" });
const addr = (value: string) => new Address(value).toScVal();

type CallName =
  | "create_guarantee"
  | "fund_guarantee"
  | "cancel_guarantee"
  | "propose_settlement"
  | "accept_settlement"
  | "reject_settlement"
  | "execute_settlement"
  | "return_to_guarantor"
  | "propose_extension"
  | "accept_extension"
  | "cancel_extension"
  | "set_treasury"
  | "set_fee_bps";

export type ContractCall = { method: CallName; args: xdr.ScVal[] };

export const calls = {
  createGuarantee: (params: {
    id: bigint;
    guarantor: string;
    landlord: string;
    amount: bigint;
    endDate: bigint;
  }): ContractCall => ({
    method: "create_guarantee",
    args: [
      u64(params.id),
      addr(params.guarantor),
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
  cancelGuarantee: (id: bigint, caller: string): ContractCall => ({
    method: "cancel_guarantee",
    args: [u64(id), addr(caller)],
  }),
  proposeSettlement: (params: {
    id: bigint;
    proposer: string;
    toGuarantor: bigint;
    toLandlord: bigint;
  }): ContractCall => ({
    method: "propose_settlement",
    args: [
      u64(params.id),
      addr(params.proposer),
      i128(params.toGuarantor),
      i128(params.toLandlord),
    ],
  }),
  acceptSettlement: (id: bigint, acceptor: string): ContractCall => ({
    method: "accept_settlement",
    args: [u64(id), addr(acceptor)],
  }),
  rejectSettlement: (id: bigint, caller: string): ContractCall => ({
    method: "reject_settlement",
    args: [u64(id), addr(caller)],
  }),
  executeSettlement: (id: bigint): ContractCall => ({
    method: "execute_settlement",
    args: [u64(id)],
  }),
  returnToGuarantor: (id: bigint, amount: bigint): ContractCall => ({
    method: "return_to_guarantor",
    args: [u64(id), i128(amount)],
  }),
  proposeExtension: (params: {
    id: bigint;
    newEndDate: bigint;
    newAmount: bigint;
  }): ContractCall => ({
    method: "propose_extension",
    args: [u64(params.id), u64(params.newEndDate), i128(params.newAmount)],
  }),
  acceptExtension: (id: bigint): ContractCall => ({
    method: "accept_extension",
    args: [u64(id)],
  }),
  cancelExtension: (id: bigint, caller: string): ContractCall => ({
    method: "cancel_extension",
    args: [u64(id), addr(caller)],
  }),
  setTreasury: (treasury: string): ContractCall => ({
    method: "set_treasury",
    args: [addr(treasury)],
  }),
  setFeeBps: (bps: number): ContractCall => ({
    method: "set_fee_bps",
    args: [u32(bps)],
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
export function assertMatchesCall(
  signedXdr: string,
  call: ContractCall,
  expectedSource?: string,
) {
  const tx = TransactionBuilder.fromXDR(
    signedXdr,
    networkConfig().networkPassphrase,
  ) as Transaction;

  if (expectedSource && tx.source !== expectedSource) {
    throw new Error("The signed transaction has an unexpected source account");
  }
  if (expectedSource && tx.signatures.length === 0) {
    throw new Error("The transaction has not been signed");
  }

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
  if ( !matches ) {
    throw new Error("The signed transaction has unexpected arguments");
  }

  for (const entry of body.invokeHostFunctionOp.auth) {
    const fn = entry.rootInvocation.function;
    if (fn.type === "sorobanAuthorizedFunctionTypeContractFn") {
      const authContractId = Address.fromScAddress(
        fn.contractFn.contractAddress,
      ).toString();
      if (authContractId !== networkConfig().guaranteeContractId) {
        throw new Error(
          "The signed transaction authorizes an unexpected contract",
        );
      }
    }
  }
}

export type SubmitResult = {
  hash: string;
  ledger?: number;
  returnValue?: unknown;
};

/**
 * Wraps a user-signed inner transaction in a FeeBumpTransaction paid by the
 * platform account so end users can transact in USDC without holding XLM.
 */
export function buildFeeBumpXdr(
  innerSignedXdr: string,
  sponsorSecret = serverEnv.platformSecretKey(),
): string {
  if (!sponsorSecret) {
    throw new Error("PLATFORM_SECRET_KEY is required for fee sponsorship");
  }
  const sponsor = Keypair.fromSecret(sponsorSecret);
  const passphrase = networkConfig().networkPassphrase;
  const innerTx = TransactionBuilder.fromXDR(
    innerSignedXdr,
    passphrase,
  ) as Transaction;
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    sponsor,
    BASE_FEE,
    innerTx,
    passphrase,
  );
  feeBump.sign(sponsor);
  return feeBump.toXDR();
}

/** Submits an already signed transaction and waits for it to be applied. */
export async function submitSignedXdr(signedXdr: string): Promise<SubmitResult> {
  const server = rpcServer();
  const effectiveXdr =
    process.env.STELLAR_SPONSOR_FEES === "true" && serverEnv.platformSecretKey()
      ? buildFeeBumpXdr(signedXdr)
      : signedXdr;
  const tx = TransactionBuilder.fromXDR(
    effectiveXdr,
    networkConfig().networkPassphrase,
  );

  let sent = await server.sendTransaction(tx);
  for (let retry = 0; sent.status === "TRY_AGAIN_LATER" && retry < 3; retry++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    sent = await server.sendTransaction(tx);
  }
  if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
    throw new Error(
      `Stellar rejected the transaction (${sent.status}): ${JSON.stringify(sent.errorResult)}`,
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
  const signedXdr = tx.toXDR();
  assertMatchesCall(signedXdr, call, keypair.publicKey());
  return submitSignedXdr(signedXdr);
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
    guarantor: string;
    landlord: string;
    token: string;
    locked: bigint;
    funded: bigint;
    end_date: bigint;
    state: number;
  };

  return {
    guarantor: raw.guarantor,
    landlord: raw.landlord,
    token: raw.token,
    locked: BigInt(raw.locked),
    funded: BigInt(raw.funded),
    endDate: BigInt(raw.end_date),
    state: STATES[raw.state] ?? "Pending",
  };
}

/** Fee (in stroops) the contract would charge on a given return amount. */
export async function quoteFee(amount: bigint): Promise<bigint> {
  const server = rpcServer();
  const contract = guaranteeContract();

  const secret = serverEnv.platformSecretKey();
  if (!secret) throw new Error("PLATFORM_SECRET_KEY is not configured");
  const reader = Keypair.fromSecret(secret);
  const account = await server.getAccount(reader.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkConfig().networkPassphrase,
  })
    .addOperation(contract.call("quote_fee", i128(amount)))
    .setTimeout(TIMEOUT_SECONDS)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error("Failed to quote the fee on-chain");
  }
  if (!sim.result?.retval) throw new Error("Empty fee quote result");
  return BigInt(scValToNative(sim.result.retval) as bigint);
}

/** RG-2026-000001 -> 2026000001 */
export function onChainIdFromReference(reference: string): bigint {
  const match = /^[A-Z]{2,4}-(\d{4})-(\d{6})$/.exec(reference);
  if (!match) throw new Error(`Invalid contract reference: ${reference}`);
  return BigInt(`${match[1]}${match[2]}`);
}
