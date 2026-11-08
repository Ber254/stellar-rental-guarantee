import { eq } from "drizzle-orm";

import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { guarantees, rentalContracts } from "@/lib/db/schema";
import { isChainConfigured, serverEnv } from "@/lib/env";
import { fromStroops } from "@/lib/money";
import { getContractDetail } from "@/lib/services/contracts";
import { quoteFee, readGuarantee } from "@/lib/stellar/guarantee-contract";

async function inspectOnChain(contractId: string, userId: string, sync = false) {
  const detail = await getContractDetail(contractId, userId);
  const guarantee = detail.guarantee;
  if (!guarantee) {
    return { configured: isChainConfigured(), registered: false, onChain: null };
  }

  if (!isChainConfigured()) {
    return {
      configured: false,
      registered: false,
      onChainId: guarantee.onChainId,
      onChain: null,
    };
  }

  const onChainId = BigInt(guarantee.onChainId);
  const onChain = await readGuarantee(onChainId);
  if (!onChain) {
    return {
      configured: true,
      registered: false,
      onChainId: guarantee.onChainId,
      sorobanContractId: serverEnv.sorobanContractId(),
      onChain: null,
    };
  }

  const feeQuote = onChain.locked > 0n ? await quoteFee(onChain.locked) : 0n;
  const lockedUsdc = fromStroops(onChain.locked);
  const fundedUsdc = fromStroops(onChain.funded);

  if (sync) {
    const nextGuaranteeStatus =
      onChain.state === "Closed"
        ? "RELEASED"
        : onChain.state === "Cancelled"
          ? "CANCELLED"
          : onChain.state === "Active"
            ? "LOCKED"
            : "CREATED";

    await db
      .update(guarantees)
      .set({
        lockedAmount: lockedUsdc,
        fundedAmount: fundedUsdc,
        status: nextGuaranteeStatus,
        sorobanContractId: serverEnv.sorobanContractId() || guarantee.sorobanContractId,
      })
      .where(eq(guarantees.id, guarantee.id));

    if (onChain.state === "Closed" && detail.contract.status !== "COMPLETED") {
      await db
        .update(rentalContracts)
        .set({ status: "COMPLETED", updatedAt: new Date() })
        .where(eq(rentalContracts.id, detail.contract.id));
    } else if (onChain.state === "Cancelled" && detail.contract.status !== "CANCELLED") {
      await db
        .update(rentalContracts)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(rentalContracts.id, detail.contract.id));
    }
  }

  return {
    configured: true,
    registered: true,
    synced: sync,
    onChainId: guarantee.onChainId,
    sorobanContractId: serverEnv.sorobanContractId(),
    onChain: {
      state: onChain.state,
      locked: lockedUsdc,
      funded: fundedUsdc,
      endDate: new Date(Number(onChain.endDate) * 1000).toISOString().slice(0, 10),
      feeQuote: fromStroops(feeQuote),
      guarantor: onChain.guarantor,
      landlord: onChain.landlord,
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const data = await inspectOnChain(id, user.id, false);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const data = await inspectOnChain(id, user.id, true);
    return Response.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
