import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { feeForStroops } from "@/lib/business-rules";
import { assertTransition } from "@/lib/contract-state";
import { db } from "@/lib/db";
import {
  agreements,
  blockchainTransactions,
  extensions,
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
import { amountsWithinLocked, formatUsdc, fromStroops, toStroops } from "@/lib/money";
import {
  assertMatchesCall,
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
import { notify, restingStatus, roleOf } from "./contracts";

export const CHAIN_STEPS = [
  "create",
  "fund",
  "cancel",
  "propose",
  "accept",
  "reject",
  "execute",
  "return-unilateral",
  "extend-propose",
  "extend-accept",
  "extend-cancel",
] as const;

export type ChainStep = (typeof CHAIN_STEPS)[number];

export const proposePayloadSchema = z.object({
  toGuarantor: z.string().regex(/^\d+(\.\d{1,7})?$/),
  toLandlord: z.string().regex(/^\d+(\.\d{1,7})?$/),
  reason: z.string().max(500).optional().or(z.literal("")),
});

export const returnUnilateralPayloadSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,7})?$/),
});

export const extensionPayloadSchema = z.object({
  newEndDate: z.iso.date(),
  newAmount: z.string().regex(/^\d+(\.\d{1,7})?$/),
});

export type ProposePayload = z.infer<typeof proposePayloadSchema>;
export type ReturnUnilateralPayload = z.infer<typeof returnUnilateralPayloadSchema>;
export type ExtensionPayload = z.infer<typeof extensionPayloadSchema>;

export type StepPayload = {
  propose?: ProposePayload;
  returnUnilateral?: ReturnUnilateralPayload;
  extension?: ExtensionPayload;
};

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
  cancel: "CANCEL_GUARANTEE",
  propose: "PROPOSE_SETTLEMENT",
  accept: "ACCEPT_SETTLEMENT",
  reject: "REJECT_SETTLEMENT",
  execute: "EXECUTE_SETTLEMENT",
  "return-unilateral": "RETURN_TO_GUARANTOR",
  "extend-propose": "PROPOSE_EXTENSION",
  "extend-accept": "ACCEPT_EXTENSION",
  "extend-cancel": "CANCEL_EXTENSION",
};

async function loadContext(user: User, contractId: string): Promise<Context> {
  const [row] = await db
    .select({ contract: rentalContracts, guarantee: guarantees })
    .from(rentalContracts)
    .leftJoin(guarantees, eq(guarantees.contractId, rentalContracts.id))
    .where(eq(rentalContracts.id, contractId));

  if (!row?.contract) throw notFound("Contract not found", "contractNotFound");
  if (!row.guarantee) throw notFound("Guarantee not found for this contract", "guaranteeNotFound");

  const role = roleOf(row.contract, user.id);
  return {
    user,
    contract: row.contract,
    guarantee: row.guarantee,
    role,
    onChainId: BigInt(row.guarantee.onChainId),
    wallet:
      role === "GUARANTOR" ? row.contract.guarantorWallet : (row.contract.landlordWallet ?? ""),
  };
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

async function pendingExtension(contractId: string) {
  const [row] = await db
    .select()
    .from(extensions)
    .where(and(eq(extensions.contractId, contractId), eq(extensions.status, "PENDING")));
  return row ?? null;
}

const lockedOf = (guarantee: Guarantee) => guarantee.lockedAmount ?? guarantee.amount;

/**
 * Validates the step against the off-chain state machine and returns a builder
 * for the matching contract call. The call itself is only built when the chain
 * is configured, so demo mode never needs on-chain addresses.
 */
function planStep(ctx: Context, step: ChainStep, payload: StepPayload): () => ContractCall {
  const { contract, guarantee, role, onChainId } = ctx;
  const amount = toStroops(contract.guaranteeAmount);
  const locked = lockedOf(guarantee);
  const inNegotiation = contract.status === "RETURN_REQUESTED" || contract.status === "NEGOTIATION";

  switch (step) {
    case "create": {
      if (role !== "GUARANTOR") throw forbidden("Only the guarantor registers the guarantee", "onlyGuarantorRegisters");
      if (contract.status !== "AWAITING_FUNDING") {
        throw badRequest("The guarantee is not waiting for the deposit", "notAwaitingDeposit");
      }
      if (guarantee.status !== "CREATED") {
        throw badRequest("The guarantee is already registered on Stellar", "guaranteeAlreadyRegistered");
      }
      if (!contract.landlordWallet) {
        throw badRequest("The landlord has not connected a wallet yet", "notAwaitingDeposit");
      }
      return () =>
        calls.createGuarantee({
          id: onChainId,
          guarantor: contract.guarantorWallet,
          landlord: contract.landlordWallet!,
          amount,
          endDate: BigInt(Math.floor(contract.endDate.getTime() / 1000)),
        });
    }
    case "fund": {
      if (role !== "GUARANTOR") throw forbidden("Only the guarantor can fund the guarantee", "onlyGuarantorFunds");
      if (contract.status !== "AWAITING_FUNDING") {
        throw badRequest("The guarantee is not waiting for the deposit", "notAwaitingDeposit");
      }
      return () => calls.fundGuarantee(onChainId);
    }
    case "cancel": {
      if (contract.status !== "AWAITING_FUNDING") {
        throw badRequest("Only a guarantee that has not been funded yet can be cancelled", "notPending");
      }
      return () => calls.cancelGuarantee(onChainId, ctx.wallet);
    }
    case "propose": {
      const proposal = proposePayloadSchema.parse(payload.propose);
      if (!amountsWithinLocked(proposal.toGuarantor, proposal.toLandlord, locked)) {
        throw badRequest(`The split cannot exceed ${formatUsdc(locked)}`, "exceedsLocked");
      }
      if (contract.status !== "ACTIVE" && contract.status !== "EXPIRED" && !inNegotiation) {
        throw badRequest("There is nothing to negotiate right now", "notActive");
      }
      return () =>
        calls.proposeSettlement({
          id: onChainId,
          proposer: ctx.wallet,
          toGuarantor: toStroops(proposal.toGuarantor),
          toLandlord: toStroops(proposal.toLandlord),
        });
    }
    case "accept": {
      if (!inNegotiation) throw badRequest("There is no proposal to accept", "noSettlementToAccept");
      return () => calls.acceptSettlement(onChainId, ctx.wallet);
    }
    case "reject": {
      if (!inNegotiation) throw badRequest("There is no proposal to reject", "noSettlementToReject");
      return () => calls.rejectSettlement(onChainId, ctx.wallet);
    }
    case "execute": {
      if (contract.status !== "AGREED") {
        throw badRequest("The parties have not agreed on a distribution yet", "noAgreementYet");
      }
      return () => calls.executeSettlement(onChainId);
    }
    case "return-unilateral": {
      if (role !== "LANDLORD") throw forbidden("Only the landlord can return funds unilaterally", "onlyLandlordReturns");
      if (contract.status !== "ACTIVE" && contract.status !== "EXPIRED") {
        throw badRequest("The guarantee is not active", "notActive");
      }
      const { amount: returnAmount } = returnUnilateralPayloadSchema.parse(payload.returnUnilateral);
      if (!amountsWithinLocked(returnAmount, "0", locked)) {
        throw badRequest(`The amount cannot exceed ${formatUsdc(locked)}`, "exceedsLocked");
      }
      return () => calls.returnToGuarantor(onChainId, toStroops(returnAmount));
    }
    case "extend-propose": {
      if (role !== "GUARANTOR") throw forbidden("Only the guarantor can propose an extension", "onlyGuarantorExtends");
      if (contract.status !== "ACTIVE" && contract.status !== "EXPIRED") {
        throw badRequest("The guarantee is not active", "notActive");
      }
      const ext = extensionPayloadSchema.parse(payload.extension);
      return () =>
        calls.proposeExtension({
          id: onChainId,
          newEndDate: BigInt(Math.floor(new Date(ext.newEndDate).getTime() / 1000)),
          newAmount: toStroops(ext.newAmount),
        });
    }
    case "extend-accept": {
      if (role !== "LANDLORD") throw forbidden("Only the landlord can accept an extension", "onlyLandlordAcceptsExtension");
      return () => calls.acceptExtension(onChainId);
    }
    case "extend-cancel": {
      return () => calls.cancelExtension(onChainId, ctx.wallet);
    }
  }
}

async function setStatus(contract: RentalContract, status: RentalContract["status"]) {
  if (contract.status === status) return;
  assertTransition(contract.status, status);
  await db
    .update(rentalContracts)
    .set({ status, updatedAt: new Date() })
    .where(eq(rentalContracts.id, contract.id));
}

async function applyStep(
  ctx: Context,
  step: ChainStep,
  payload: StepPayload,
  tx: { hash: string | null; ledger?: number; simulated: boolean },
) {
  const { contract, guarantee, user, role } = ctx;
  const now = new Date();
  const other =
    role === "GUARANTOR" ? contract.landlordId : contract.guarantorId;

  await db.insert(blockchainTransactions).values({
    contractId: contract.id,
    kind: TX_KIND[step],
    status: "SUCCESS",
    txHash: tx.hash,
    ledger: tx.ledger ?? null,
    network: serverEnv.stellarNetwork(),
    simulated: tx.simulated,
    sourceAddress: ctx.wallet || null,
  });

  switch (step) {
    case "create": {
      await db
        .update(guarantees)
        .set({
          sorobanContractId: serverEnv.sorobanContractId() || null,
          simulated: tx.simulated,
        })
        .where(eq(guarantees.id, guarantee.id));
      break;
    }
    case "fund": {
      await db
        .update(guarantees)
        .set({
          status: "LOCKED",
          fundedAt: now,
          lockedAmount: contract.guaranteeAmount,
          fundedAmount: contract.guaranteeAmount,
          simulated: tx.simulated,
        })
        .where(eq(guarantees.id, guarantee.id));
      await setStatus(contract, "ACTIVE");
      await notify(other, contract.id, "GUARANTEE_FUNDED", "guaranteeFunded", {
        amount: formatUsdc(contract.guaranteeAmount),
        reference: contract.reference,
      });
      break;
    }
    case "cancel": {
      await db
        .update(guarantees)
        .set({ status: "CANCELLED", lockedAmount: "0" })
        .where(eq(guarantees.id, guarantee.id));
      await setStatus(contract, "CANCELLED");
      await notify(other, contract.id, "GUARANTEE_REJECTED", "guaranteeCancelled", {
        actor: user.name,
        reference: contract.reference,
      });
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
          kind: "SETTLEMENT",
          proposedBy: user.id,
          proposedByRole: role,
          toGuarantor: proposal.toGuarantor,
          toLandlord: proposal.toLandlord,
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
      const nextStatus =
        contract.status === "RETURN_REQUESTED" || contract.status === "NEGOTIATION"
          ? "NEGOTIATION"
          : "RETURN_REQUESTED";
      await setStatus(contract, nextStatus);
      await notify(other, contract.id, "RETURN_REQUESTED", "returnProposed", {
        actor: user.name,
        reference: contract.reference,
        toGuarantor: formatUsdc(proposal.toGuarantor),
        toLandlord: formatUsdc(proposal.toLandlord),
      });
      break;
    }
    case "accept": {
      const current = await openProposal(contract.id);
      if (!current) throw badRequest("There is no proposal to accept", "noSettlementToAccept");
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
      const fee = feeForStroops(toStroops(current.toGuarantor));
      await db.insert(agreements).values({
        contractId: contract.id,
        proposalId: current.id,
        toGuarantor: current.toGuarantor,
        toLandlord: current.toLandlord,
        feeAmount: fromStroops(fee),
        guarantorAcceptedAt: role === "GUARANTOR" || current.proposedByRole === "GUARANTOR" ? now : null,
        landlordAcceptedAt: role === "LANDLORD" || current.proposedByRole === "LANDLORD" ? now : null,
      });
      await setStatus(contract, "AGREED");
      await notify(other, contract.id, "RETURN_APPROVED", "returnAgreed", {
        actor: user.name,
        reference: contract.reference,
      });
      break;
    }
    case "reject": {
      const current = await openProposal(contract.id);
      if (!current) throw badRequest("There is no proposal to reject", "noSettlementToReject");
      const reason = proposePayloadSchema.shape.reason.optional().parse(payload.propose?.reason);
      await db
        .update(proposals)
        .set({ status: "REJECTED" })
        .where(eq(proposals.id, current.id));
      await db.insert(proposalActions).values({
        proposalId: current.id,
        actorId: user.id,
        actorRole: role,
        action: "REJECT",
        note: reason || null,
      });
      await setStatus(contract, restingStatus(contract));
      await notify(
        other,
        contract.id,
        "RETURN_REJECTED",
        reason ? "returnRejected" : "returnRejectedNoReason",
        { actor: user.name, reference: contract.reference, reason: reason ?? "" },
      );
      break;
    }
    case "execute": {
      const [agreement] = await db
        .select()
        .from(agreements)
        .where(and(eq(agreements.contractId, contract.id), sql`${agreements.executedAt} is null`))
        .orderBy(desc(agreements.createdAt));
      const paidOut = toStroops(agreement?.toGuarantor ?? "0") + toStroops(agreement?.toLandlord ?? "0");
      const newLocked = lockedOf(guarantee) ? toStroops(lockedOf(guarantee)) - paidOut : 0n;

      await db
        .update(guarantees)
        .set({
          lockedAmount: fromStroops(newLocked),
          status: newLocked <= 0n ? "RELEASED" : "LOCKED",
          releasedAt: newLocked <= 0n ? now : null,
        })
        .where(eq(guarantees.id, guarantee.id));

      if (agreement) {
        await db
          .update(agreements)
          .set({ executedAt: now })
          .where(eq(agreements.id, agreement.id));
      }

      await setStatus(contract, newLocked <= 0n ? "COMPLETED" : restingStatus(contract));
      await notify(other, contract.id, "RETURN_APPROVED", "returnExecuted", {
        reference: contract.reference,
      });
      break;
    }
    case "return-unilateral": {
      const { amount: returnAmount } = returnUnilateralPayloadSchema.parse(payload.returnUnilateral);
      const amountStroops = toStroops(returnAmount);
      const fee = feeForStroops(amountStroops);
      const newLocked = toStroops(lockedOf(guarantee)) - amountStroops;

      const [created] = await db
        .insert(proposals)
        .values({
          contractId: contract.id,
          kind: "UNILATERAL_RETURN",
          proposedBy: user.id,
          proposedByRole: "LANDLORD",
          toGuarantor: returnAmount,
          toLandlord: "0",
          status: "ACCEPTED",
        })
        .returning();
      await db.insert(agreements).values({
        contractId: contract.id,
        proposalId: created.id,
        toGuarantor: returnAmount,
        toLandlord: "0",
        feeAmount: fromStroops(fee),
        landlordAcceptedAt: now,
        executedAt: now,
      });

      await db
        .update(guarantees)
        .set({
          lockedAmount: fromStroops(newLocked),
          status: newLocked <= 0n ? "RELEASED" : "LOCKED",
          releasedAt: newLocked <= 0n ? now : null,
        })
        .where(eq(guarantees.id, guarantee.id));

      await setStatus(contract, newLocked <= 0n ? "COMPLETED" : restingStatus(contract));
      await notify(other, contract.id, "RETURN_UNILATERAL", "returnUnilateral", {
        actor: user.name,
        amount: formatUsdc(returnAmount),
        reference: contract.reference,
      });
      break;
    }
    case "extend-propose": {
      const ext = extensionPayloadSchema.parse(payload.extension);
      const newAmountStroops = toStroops(ext.newAmount);
      const lockedStroops = toStroops(lockedOf(guarantee));
      const topUp = newAmountStroops > lockedStroops ? newAmountStroops - lockedStroops : 0n;

      await db.insert(extensions).values({
        contractId: contract.id,
        proposedNewEndDate: new Date(ext.newEndDate),
        proposedNewAmount: ext.newAmount,
        topUpAmount: fromStroops(topUp),
      });

      await notify(other, contract.id, "EXTENSION_PROPOSED", "extensionProposed", {
        actor: user.name,
        reference: contract.reference,
        amount: formatUsdc(ext.newAmount),
        date: ext.newEndDate,
      });
      break;
    }
    case "extend-accept": {
      const pending = await pendingExtension(contract.id);
      if (!pending) throw badRequest("There is no extension to accept", "noExtensionPending");

      const lockedStroops = toStroops(lockedOf(guarantee));
      const newAmountStroops = toStroops(pending.proposedNewAmount);
      const topUp = toStroops(pending.topUpAmount);
      const refund = newAmountStroops < lockedStroops ? lockedStroops - newAmountStroops : 0n;
      const newLocked = lockedStroops - refund + topUp;
      const newFunded = toStroops(guarantee.fundedAmount ?? guarantee.amount) + topUp;

      await db
        .update(extensions)
        .set({ status: "ACCEPTED", refundAmount: fromStroops(refund), resolvedAt: now })
        .where(eq(extensions.id, pending.id));

      await db
        .update(guarantees)
        .set({
          lockedAmount: fromStroops(newLocked),
          fundedAmount: fromStroops(newFunded),
          status: newLocked <= 0n ? "RELEASED" : "LOCKED",
        })
        .where(eq(guarantees.id, guarantee.id));

      await db
        .update(rentalContracts)
        .set({
          endDate: pending.proposedNewEndDate,
          guaranteeAmount: pending.proposedNewAmount,
          updatedAt: now,
        })
        .where(eq(rentalContracts.id, contract.id));

      await setStatus({ ...contract }, newLocked <= 0n ? "COMPLETED" : "ACTIVE");
      await notify(other, contract.id, "EXTENSION_ACCEPTED", "extensionAccepted", {
        actor: user.name,
        reference: contract.reference,
      });
      break;
    }
    case "extend-cancel": {
      const pending = await pendingExtension(contract.id);
      if (!pending) throw badRequest("There is no extension to cancel", "noExtensionPending");
      await db
        .update(extensions)
        .set({ status: "CANCELLED", resolvedAt: now })
        .where(eq(extensions.id, pending.id));
      await notify(other, contract.id, "EXTENSION_CANCELLED", "extensionCancelled", {
        actor: user.name,
        reference: contract.reference,
      });
      break;
    }
  }
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

  if (step === "execute") {
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
  assertMatchesCall(signedXdr, planStep(ctx, step, payload)());

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
