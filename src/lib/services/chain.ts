import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { assertTransition } from "@/lib/contract-state";
import { db } from "@/lib/db";
import {
  agreements,
  blockchainTransactions,
  guarantees,
  proposalActions,
  proposals,
  rentalContracts,
  type Guarantee,
  type PartyRole,
  type RentalContract,
  type User,
} from "@/lib/db/schema";
import { isChainConfigured, serverEnv } from "@/lib/env";
import { amountsMatchTotal, formatUsdc, toStroops } from "@/lib/money";
import {
  buildCallXdr,
  calls,
  platformSignAndSubmit,
  signAndSubmit,
  submitSignedXdr,
  type ContractCall,
  type SubmitResult,
} from "@/lib/stellar/guarantee-contract";
import { demoSecretFor } from "@/lib/stellar/demo-signer";
import { badRequest, forbidden, notFound } from "./errors";
import { notify, roleOf } from "./contracts";

export const CHAIN_STEPS = [
  "create",
  "fund",
  "request-release",
  "propose",
  "accept",
  "release",
] as const;

export type ChainStep = (typeof CHAIN_STEPS)[number];

export const proposePayloadSchema = z.object({
  toLandlord: z.string().regex(/^\d+(\.\d{1,7})?$/),
  toTenant: z.string().regex(/^\d+(\.\d{1,7})?$/),
  reason: z.string().max(500).optional().or(z.literal("")),
});

export type ProposePayload = z.infer<typeof proposePayloadSchema>;

export type StepPayload = { propose?: ProposePayload };

type Context = {
  user: User;
  contract: RentalContract;
  guarantee: Guarantee;
  role: PartyRole;
  onChainId: bigint;
  wallet: string;
};

export type StepOutcome =
  | { mode: "sign"; xdr: string; step: ChainStep }
  | { mode: "done"; step: ChainStep; txHash: string | null; simulated: boolean };

const TX_KIND: Record<ChainStep, (typeof blockchainTransactions.kind.enumValues)[number]> = {
  create: "CREATE_GUARANTEE",
  fund: "FUND_GUARANTEE",
  "request-release": "REQUEST_RELEASE",
  propose: "PROPOSE_DISTRIBUTION",
  accept: "ACCEPT_PROPOSAL",
  release: "RELEASE_FUNDS",
};

async function loadContext(
  user: User,
  contractId: string,
): Promise<Context> {
  const [row] = await db
    .select({ contract: rentalContracts, guarantee: guarantees })
    .from(rentalContracts)
    .leftJoin(guarantees, eq(guarantees.contractId, rentalContracts.id))
    .where(eq(rentalContracts.id, contractId));

  if (!row?.contract) throw notFound("Contract not found");
  if (!row.guarantee) throw notFound("Guarantee not found for this contract");

  const role = roleOf(row.contract, user.id);
  return {
    user,
    contract: row.contract,
    guarantee: row.guarantee,
    role,
    onChainId: BigInt(row.guarantee.onChainId),
    wallet:
      role === "TENANT" ? row.contract.tenantWallet : row.contract.landlordWallet,
  };
}

/**
 * Validates the step against the off-chain state machine and returns a builder
 * for the matching contract call. The call itself is only built when the chain
 * is configured, so demo mode never needs on-chain addresses.
 */
function planStep(
  ctx: Context,
  step: ChainStep,
  payload: StepPayload,
): () => ContractCall {
  const { contract, role, onChainId } = ctx;
  const amount = toStroops(contract.guaranteeAmount);

  switch (step) {
    case "create": {
      if (role !== "TENANT") throw forbidden("Only the tenant registers the guarantee");
      if (contract.status !== "AWAITING_FUNDING") {
        throw badRequest("The contract is not waiting for the deposit");
      }
      if (ctx.guarantee.status !== "CREATED") {
        throw badRequest("The guarantee is already registered on Stellar");
      }
      return () =>
        calls.createGuarantee({
          id: onChainId,
          tenant: contract.tenantWallet,
          landlord: contract.landlordWallet,
          amount,
          endDate: BigInt(Math.floor(contract.endDate.getTime() / 1000)),
        });
    }
    case "fund": {
      if (role !== "TENANT") throw forbidden("Only the tenant can fund the guarantee");
      if (contract.status !== "AWAITING_FUNDING") {
        throw badRequest("The contract is not waiting for the deposit");
      }
      return () => calls.fundGuarantee(onChainId);
    }
    case "request-release": {
      if (role !== "TENANT") {
        throw forbidden("Only the tenant can request the guarantee back");
      }
      assertTransition(contract.status, "RETURN_REQUESTED");
      return () => calls.requestRelease(onChainId, ctx.wallet);
    }
    case "propose": {
      const proposal = proposePayloadSchema.parse(payload.propose);
      if (
        !amountsMatchTotal(
          proposal.toLandlord,
          proposal.toTenant,
          contract.guaranteeAmount,
        )
      ) {
        throw badRequest(
          `The split must add up to ${formatUsdc(contract.guaranteeAmount)}`,
        );
      }
      if (
        contract.status !== "RETURN_REQUESTED" &&
        contract.status !== "NEGOTIATION"
      ) {
        throw badRequest("There is no open return request for this contract");
      }
      return () =>
        calls.proposeDistribution({
          id: onChainId,
          proposer: ctx.wallet,
          toLandlord: toStroops(proposal.toLandlord),
          toTenant: toStroops(proposal.toTenant),
        });
    }
    case "accept": {
      if (contract.status !== "NEGOTIATION") {
        throw badRequest("There is no proposal to accept");
      }
      return () => calls.acceptProposal(onChainId, ctx.wallet);
    }
    case "release": {
      if (contract.status !== "AGREED") {
        throw badRequest("The parties have not agreed on a distribution yet");
      }
      return () => calls.releaseFunds(onChainId);
    }
  }
}

async function openProposal(contractId: string) {
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(
      and(eq(proposals.contractId, contractId), eq(proposals.status, "PENDING")),
    );
  return proposal ?? null;
}

async function applyStep(
  ctx: Context,
  step: ChainStep,
  payload: StepPayload,
  tx: { hash: string | null; ledger?: number; simulated: boolean },
) {
  const { contract, user, role } = ctx;
  const now = new Date();
  const other = role === "TENANT" ? contract.landlordId : contract.tenantId;

  await db.insert(blockchainTransactions).values({
    contractId: contract.id,
    kind: TX_KIND[step],
    status: "SUCCESS",
    txHash: tx.hash,
    ledger: tx.ledger ?? null,
    network: serverEnv.stellarNetwork(),
    simulated: tx.simulated,
    amount: step === "release" ? contract.guaranteeAmount : null,
    sourceAddress: step === "release" ? null : ctx.wallet,
  });

  switch (step) {
    case "create": {
      await db
        .update(guarantees)
        .set({
          sorobanContractId: serverEnv.sorobanContractId() || null,
          simulated: tx.simulated,
        })
        .where(eq(guarantees.id, ctx.guarantee.id));
      break;
    }
    case "fund": {
      await db
        .update(guarantees)
        .set({ status: "LOCKED", fundedAt: now, simulated: tx.simulated })
        .where(eq(guarantees.id, ctx.guarantee.id));
      await setStatus(contract, "ACTIVE");
      await notify(
        other,
        contract.id,
        "Guarantee funded",
        `${formatUsdc(contract.guaranteeAmount)} are locked for ${contract.reference}.`,
      );
      break;
    }
    case "request-release": {
      await setStatus(contract, "RETURN_REQUESTED");
      await notify(
        other,
        contract.id,
        "Return requested",
        `${user.name} asked for the guarantee of ${contract.reference} to be returned.`,
      );
      break;
    }
    case "propose": {
      const proposal = proposePayloadSchema.parse(payload.propose);
      const current = await openProposal(contract.id);
      if (current) {
        await db
          .update(proposals)
          .set({ status: "SUPERSEDED" })
          .where(eq(proposals.id, current.id));
      }
      const [created] = await db
        .insert(proposals)
        .values({
          contractId: contract.id,
          proposedBy: user.id,
          proposedByRole: role,
          toLandlord: proposal.toLandlord,
          toTenant: proposal.toTenant,
          reason: proposal.reason || null,
          round: (current?.round ?? 0) + 1,
        })
        .returning();
      await db.insert(proposalActions).values({
        proposalId: created.id,
        actorId: user.id,
        actorRole: role,
        action: current ? "COUNTER" : "PROPOSE",
        note: proposal.reason || null,
      });
      if (contract.status !== "NEGOTIATION") {
        await setStatus(contract, "NEGOTIATION");
      }
      await notify(
        other,
        contract.id,
        "New proposal",
        `${user.name} proposes ${formatUsdc(proposal.toLandlord)} to the landlord and ${formatUsdc(
          proposal.toTenant,
        )} to the tenant.`,
      );
      break;
    }
    case "accept": {
      const current = await openProposal(contract.id);
      if (!current) throw badRequest("There is no proposal to accept");
      if (current.proposedBy === user.id) {
        throw badRequest("You cannot accept your own proposal");
      }
      await db
        .update(proposals)
        .set({ status: "ACCEPTED" })
        .where(eq(proposals.id, current.id));
      await db.insert(proposalActions).values({
        proposalId: current.id,
        actorId: user.id,
        actorRole: role,
        action: "ACCEPT",
      });
      await db
        .insert(agreements)
        .values({
          contractId: contract.id,
          proposalId: current.id,
          toLandlord: current.toLandlord,
          toTenant: current.toTenant,
          tenantAcceptedAt:
            role === "TENANT" || current.proposedByRole === "TENANT" ? now : null,
          landlordAcceptedAt:
            role === "LANDLORD" || current.proposedByRole === "LANDLORD"
              ? now
              : null,
        })
        .onConflictDoNothing();
      await setStatus(contract, "AGREED");
      await notify(
        other,
        contract.id,
        "Agreement reached",
        `${user.name} accepted the distribution for ${contract.reference}.`,
      );
      break;
    }
    case "release": {
      await db
        .update(guarantees)
        .set({ status: "RELEASED", releasedAt: now })
        .where(eq(guarantees.id, ctx.guarantee.id));
      await setStatus(contract, "RELEASED");
      await setStatus({ ...contract, status: "RELEASED" }, "COMPLETED");
      await notify(
        other,
        contract.id,
        "Funds released",
        `The guarantee of ${contract.reference} was distributed on Stellar.`,
      );
      break;
    }
  }
}

async function setStatus(
  contract: RentalContract,
  status: RentalContract["status"],
) {
  assertTransition(contract.status, status);
  await db
    .update(rentalContracts)
    .set({ status, updatedAt: new Date() })
    .where(eq(rentalContracts.id, contract.id));
}

/**
 * Runs a step. When the acting wallet is not server-held, the caller gets an
 * XDR to sign in their wallet and finishes through {@link completeStep}.
 */
export async function startStep(
  user: User,
  contractId: string,
  step: ChainStep,
  payload: StepPayload = {},
): Promise<StepOutcome> {
  const ctx = await loadContext(user, contractId);
  const buildCall = planStep(ctx, step, payload);

  if (!isChainConfigured()) {
    await applyStep(ctx, step, payload, { hash: null, simulated: true });
    return { mode: "done", step, txHash: null, simulated: true };
  }

  const call = buildCall();

  if (step === "release") {
    const result = await platformSignAndSubmit(call);
    await applyStep(ctx, step, payload, {
      hash: result.hash,
      ledger: result.ledger,
      simulated: false,
    });
    return { mode: "done", step, txHash: result.hash, simulated: false };
  }

  const demoSecret = demoSecretFor(ctx.wallet);
  if (demoSecret) {
    const result = await signAndSubmit(demoSecret, call);
    await applyStep(ctx, step, payload, {
      hash: result.hash,
      ledger: result.ledger,
      simulated: false,
    });
    return { mode: "done", step, txHash: result.hash, simulated: false };
  }

  const xdr = await buildCallXdr(ctx.wallet, call);
  return { mode: "sign", xdr, step };
}

/** Submits a transaction signed by the user's wallet and records the result. */
export async function completeStep(
  user: User,
  contractId: string,
  step: ChainStep,
  payload: StepPayload,
  signedXdr: string,
): Promise<StepOutcome> {
  const ctx = await loadContext(user, contractId);
  planStep(ctx, step, payload);

  let result: SubmitResult;
  try {
    result = await submitSignedXdr(signedXdr);
  } catch (error) {
    await db.insert(blockchainTransactions).values({
      contractId: ctx.contract.id,
      kind: TX_KIND[step],
      status: "FAILED",
      network: serverEnv.stellarNetwork(),
      sourceAddress: ctx.wallet,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  await applyStep(ctx, step, payload, {
    hash: result.hash,
    ledger: result.ledger,
    simulated: false,
  });
  return { mode: "done", step, txHash: result.hash, simulated: false };
}

/** Rejecting a proposal is off-chain: the chain keeps the last proposal until replaced. */
export async function rejectProposal(user: User, contractId: string) {
  const ctx = await loadContext(user, contractId);
  const current = await openProposal(contractId);
  if (!current) throw badRequest("There is no proposal to reject");
  if (current.proposedBy === user.id) {
    throw badRequest("You cannot reject your own proposal");
  }

  await db
    .update(proposals)
    .set({ status: "REJECTED" })
    .where(eq(proposals.id, current.id));
  await db.insert(proposalActions).values({
    proposalId: current.id,
    actorId: user.id,
    actorRole: ctx.role,
    action: "REJECT",
  });
  await notify(
    ctx.role === "TENANT" ? ctx.contract.landlordId : ctx.contract.tenantId,
    contractId,
    "Proposal rejected",
    `${user.name} rejected the proposal for ${ctx.contract.reference}.`,
  );
}
