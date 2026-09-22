import { randomBytes } from "node:crypto";

import { and, desc, eq, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { isValidAlias, normalizeAlias } from "@/lib/alias";
import { isPastAcceptanceDeadline } from "@/lib/business-rules";
import { db } from "@/lib/db";
import {
  agreements,
  blockchainTransactions,
  contractCounters,
  extensions,
  guarantees,
  notifications,
  properties,
  proposals,
  rentalContracts,
  users,
  type ContractStatus,
  type PartyRole,
  type RentalContract,
  type User,
} from "@/lib/db/schema";
import { assertTransition } from "@/lib/contract-state";
import { onChainIdFromReference } from "@/lib/stellar/guarantee-contract";
import { badRequest, forbidden, notFound } from "./errors";

const STELLAR_ADDRESS = /^G[A-Z2-7]{55}$/;

export const createContractSchema = z
  .object({
    landlordAlias: z.string().min(3).max(30),
    propertyLabel: z.string().min(2).max(120).optional().or(z.literal("")),
    propertyAddress: z.string().min(4).max(240).optional().or(z.literal("")),
    guarantorWallet: z.string().regex(STELLAR_ADDRESS, "Invalid Stellar address"),
    guaranteeAmount: z
      .string()
      .regex(/^\d+(\.\d{1,7})?$/, "Invalid amount")
      .refine((value) => Number(value) > 0, "Amount must be greater than zero"),
    rentAmount: z
      .string()
      .regex(/^\d+(\.\d{1,7})?$/)
      .optional()
      .or(z.literal("")),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .refine((value) => new Date(value.endDate) > new Date(value.startDate), {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

export type CreateContractInput = z.infer<typeof createContractSchema>;

async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await db
    .insert(contractCounters)
    .values({ year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: contractCounters.year,
      set: { lastNumber: sql`${contractCounters.lastNumber} + 1` },
    })
    .returning();
  return `SFX-${year}-${String(row.lastNumber).padStart(6, "0")}`;
}

/** Public identity of a user found by alias, safe to show before a guarantee is sent. */
export async function lookupByAlias(alias: string) {
  const normalized = normalizeAlias(alias);
  if (!isValidAlias(normalized)) {
    throw badRequest("That alias is not valid", "invalidAlias");
  }
  const [user] = await db
    .select({
      id: users.id,
      alias: users.alias,
      name: users.name,
      lastName: users.lastName,
      photoUrl: users.photoUrl,
    })
    .from(users)
    .where(eq(users.alias, normalized));
  if (!user) throw notFound("No user with that alias", "aliasNotFound");
  return user;
}

export async function createRentalContract(
  guarantor: User,
  input: CreateContractInput,
) {
  const landlordAlias = normalizeAlias(input.landlordAlias);
  const landlord = await lookupByAlias(landlordAlias);
  if (landlord.id === guarantor.id) {
    throw badRequest("You cannot create a guarantee for yourself", "cannotGuaranteeYourself");
  }

  let propertyId: string | null = null;
  if (input.propertyLabel && input.propertyAddress) {
    const [property] = await db
      .insert(properties)
      .values({
        label: input.propertyLabel,
        address: input.propertyAddress,
        createdBy: guarantor.id,
      })
      .returning();
    propertyId = property.id;
  }

  const reference = await nextReference();
  const inviteToken = randomBytes(24).toString("base64url");

  const [landlordRow] = await db
    .select({ stellarAddress: users.stellarAddress })
    .from(users)
    .where(eq(users.id, landlord.id));

  const [contract] = await db
    .insert(rentalContracts)
    .values({
      reference,
      propertyId,
      guarantorId: guarantor.id,
      landlordId: landlord.id,
      guarantorWallet: input.guarantorWallet,
      landlordWallet: landlordRow?.stellarAddress ?? null,
      guaranteeAmount: input.guaranteeAmount,
      rentAmount: input.rentAmount || null,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      notes: input.notes || null,
      status: "PENDING_ACCEPTANCE",
      inviteToken,
    })
    .returning();

  await db.insert(guarantees).values({
    contractId: contract.id,
    amount: input.guaranteeAmount,
    onChainId: onChainIdFromReference(reference).toString(),
  });

  if (!guarantor.stellarAddress) {
    await db
      .update(users)
      .set({ stellarAddress: input.guarantorWallet })
      .where(eq(users.id, guarantor.id));
  }

  await notify(landlord.id, contract.id, "GUARANTEE_RECEIVED", {
    name: guarantor.name,
    reference,
    amount: input.guaranteeAmount,
  });

  return contract;
}

export const updateContractSchema = z
  .object({
    propertyLabel: z.string().min(2).max(120).optional().or(z.literal("")),
    propertyAddress: z.string().min(4).max(240).optional().or(z.literal("")),
    guaranteeAmount: z
      .string()
      .regex(/^\d+(\.\d{1,7})?$/, "Invalid amount")
      .refine((value) => Number(value) > 0, "Amount must be greater than zero"),
    rentAmount: z
      .string()
      .regex(/^\d+(\.\d{1,7})?$/)
      .optional()
      .or(z.literal("")),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .refine((value) => new Date(value.endDate) > new Date(value.startDate), {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

export type UpdateContractInput = z.infer<typeof updateContractSchema>;

/** Only the guarantor can edit, and only while nobody has responded yet. */
export async function updatePendingContract(
  guarantor: User,
  contractId: string,
  input: UpdateContractInput,
) {
  const { contract } = await requireContractParty(contractId, guarantor.id);
  if (contract.guarantorId !== guarantor.id) {
    throw forbidden("Only the guarantor can edit this guarantee", "onlyGuarantorEdits");
  }
  if (contract.status !== "PENDING_ACCEPTANCE") {
    throw badRequest("This guarantee can no longer be edited", "notAwaitingAcceptance");
  }

  if (input.propertyLabel && input.propertyAddress) {
    if (contract.propertyId) {
      await db
        .update(properties)
        .set({ label: input.propertyLabel, address: input.propertyAddress })
        .where(eq(properties.id, contract.propertyId));
    } else {
      const [property] = await db
        .insert(properties)
        .values({
          label: input.propertyLabel,
          address: input.propertyAddress,
          createdBy: guarantor.id,
        })
        .returning();
      await db
        .update(rentalContracts)
        .set({ propertyId: property.id })
        .where(eq(rentalContracts.id, contract.id));
    }
  }

  const [updated] = await db
    .update(rentalContracts)
    .set({
      guaranteeAmount: input.guaranteeAmount,
      rentAmount: input.rentAmount || null,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      notes: input.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(rentalContracts.id, contract.id))
    .returning();

  await db
    .update(guarantees)
    .set({ amount: input.guaranteeAmount })
    .where(eq(guarantees.contractId, contract.id));

  return updated;
}

/** Only the guarantor can withdraw a guarantee nobody has responded to yet. */
export async function cancelPendingContract(guarantor: User, contractId: string) {
  const { contract } = await requireContractParty(contractId, guarantor.id);
  if (contract.guarantorId !== guarantor.id) {
    throw forbidden("Only the guarantor can cancel this guarantee", "onlyGuarantorCancels");
  }
  if (contract.status !== "PENDING_ACCEPTANCE") {
    throw badRequest("This guarantee can no longer be cancelled directly", "notPending");
  }

  assertTransition(contract.status, "CANCELLED");
  const [updated] = await db
    .update(rentalContracts)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(eq(rentalContracts.id, contract.id))
    .returning();

  await db
    .update(guarantees)
    .set({ status: "CANCELLED", lockedAmount: "0" })
    .where(eq(guarantees.contractId, contract.id));

  await notify(contract.landlordId, contract.id, "GUARANTEE_WITHDRAWN", {
    name: guarantor.name,
    reference: contract.reference,
  });

  return updated;
}

export async function acceptContract(landlord: User, contractId: string) {
  const { contract } = await requireContractParty(contractId, landlord.id);
  if (contract.landlordId !== landlord.id) {
    throw forbidden("Only the landlord can accept this guarantee", "onlyLandlordAccepts");
  }
  if (contract.status !== "PENDING_ACCEPTANCE") {
    throw badRequest("This guarantee is not awaiting acceptance", "notAwaitingAcceptance");
  }

  assertTransition(contract.status, "AWAITING_FUNDING");

  const landlordWallet = landlord.stellarAddress ?? contract.landlordWallet ?? null;

  const [updated] = await db
    .update(rentalContracts)
    .set({
      status: "AWAITING_FUNDING",
      landlordWallet,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(rentalContracts.id, contract.id))
    .returning();

  await notify(contract.guarantorId, contract.id, "GUARANTEE_ACCEPTED", {
    name: landlord.name,
    reference: contract.reference,
  });

  return updated;
}

export async function rejectContract(landlord: User, contractId: string, reason: string) {
  const { contract } = await requireContractParty(contractId, landlord.id);
  if (contract.landlordId !== landlord.id) {
    throw forbidden("Only the landlord can reject this guarantee", "onlyLandlordRejects");
  }
  if (contract.status !== "PENDING_ACCEPTANCE") {
    throw badRequest("This guarantee is not awaiting acceptance", "notAwaitingAcceptance");
  }
  if (!reason.trim()) throw badRequest("A reason is required", "reasonRequired");

  assertTransition(contract.status, "REJECTED");

  const [updated] = await db
    .update(rentalContracts)
    .set({
      status: "REJECTED",
      rejectionReason: reason,
      rejectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(rentalContracts.id, contract.id))
    .returning();

  await notify(contract.guarantorId, contract.id, "GUARANTEE_REJECTED_BY_LANDLORD", {
    name: landlord.name,
    reference: contract.reference,
    reason,
  });

  return updated;
}

/** Lazily expires a guarantee that is still pending a month after the period started. */
async function applyPendingExpiry(contract: RentalContract): Promise<RentalContract> {
  if (
    contract.status === "PENDING_ACCEPTANCE" &&
    isPastAcceptanceDeadline(contract.startDate)
  ) {
    const [updated] = await db
      .update(rentalContracts)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(rentalContracts.id, contract.id))
      .returning();
    const data = { reference: contract.reference };
    await notify(contract.guarantorId, contract.id, "GUARANTEE_EXPIRED", data);
    if (contract.landlordId) {
      await notify(contract.landlordId, contract.id, "GUARANTEE_EXPIRED", data);
    }
    return updated;
  }
  if (contract.status === "ACTIVE" && contract.endDate.getTime() < Date.now()) {
    const [updated] = await db
      .update(rentalContracts)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(eq(rentalContracts.id, contract.id))
      .returning();
    return updated;
  }
  return contract;
}

/**
 * Sweeps every guarantee that could be stale (still `PENDING_ACCEPTANCE` or
 * `ACTIVE`) and applies the same expiry rule the lazy per-request check
 * uses, so a guarantee expires on schedule even if nobody ever opens it
 * again. Meant to be called from a scheduled job (see
 * `/api/cron/expire`), not from a request path.
 */
export async function expireStaleContracts(): Promise<{
  cancelled: number;
  expired: number;
}> {
  const candidates = await db
    .select()
    .from(rentalContracts)
    .where(
      or(
        eq(rentalContracts.status, "PENDING_ACCEPTANCE"),
        eq(rentalContracts.status, "ACTIVE"),
      ),
    );

  let cancelled = 0;
  let expired = 0;
  for (const contract of candidates) {
    const after = await applyPendingExpiry(contract);
    if (after.status === contract.status) continue;
    if (after.status === "CANCELLED") cancelled += 1;
    if (after.status === "EXPIRED") expired += 1;
  }
  return { cancelled, expired };
}

export async function listContracts(userId: string) {
  const rows = await db
    .select({
      contract: rentalContracts,
      property: properties,
      guarantee: guarantees,
    })
    .from(rentalContracts)
    .leftJoin(properties, eq(properties.id, rentalContracts.propertyId))
    .leftJoin(guarantees, eq(guarantees.contractId, rentalContracts.id))
    .where(
      or(
        eq(rentalContracts.guarantorId, userId),
        eq(rentalContracts.landlordId, userId),
      ),
    )
    .orderBy(desc(rentalContracts.createdAt));

  return Promise.all(
    rows.map(async (row) => ({ ...row, contract: await applyPendingExpiry(row.contract) })),
  );
}

export async function getContractForUser(contractId: string, userId: string) {
  const [row] = await db
    .select({
      contract: rentalContracts,
      property: properties,
      guarantee: guarantees,
    })
    .from(rentalContracts)
    .leftJoin(properties, eq(properties.id, rentalContracts.propertyId))
    .leftJoin(guarantees, eq(guarantees.contractId, rentalContracts.id))
    .where(eq(rentalContracts.id, contractId));

  if (!row) throw notFound("Contract not found", "contractNotFound");
  if (row.contract.guarantorId !== userId && row.contract.landlordId !== userId) {
    throw forbidden("You are not a party of this contract", "notAParty");
  }
  return { ...row, contract: await applyPendingExpiry(row.contract) };
}

export async function getContractDetail(contractId: string, userId: string) {
  const row = await getContractForUser(contractId, userId);

  const [guarantor] = await db
    .select()
    .from(users)
    .where(eq(users.id, row.contract.guarantorId));
  const landlord = row.contract.landlordId
    ? (
        await db
          .select()
          .from(users)
          .where(eq(users.id, row.contract.landlordId))
      )[0]
    : null;

  const proposalRows = await db
    .select()
    .from(proposals)
    .where(eq(proposals.contractId, contractId))
    .orderBy(desc(proposals.createdAt));

  const [agreement] = await db
    .select()
    .from(agreements)
    .where(and(eq(agreements.contractId, contractId), sql`${agreements.executedAt} is null`))
    .orderBy(desc(agreements.createdAt));

  const [extension] = await db
    .select()
    .from(extensions)
    .where(and(eq(extensions.contractId, contractId), eq(extensions.status, "PENDING")));

  const transactions = await db
    .select()
    .from(blockchainTransactions)
    .where(eq(blockchainTransactions.contractId, contractId))
    .orderBy(desc(blockchainTransactions.createdAt));

  return {
    ...row,
    guarantor,
    landlord,
    proposals: proposalRows,
    agreement: agreement ?? null,
    pendingExtension: extension ?? null,
    transactions,
    role: roleOf(row.contract, userId),
  };
}

export function roleOf(contract: RentalContract, userId: string): PartyRole {
  if (contract.guarantorId === userId) return "GUARANTOR";
  if (contract.landlordId === userId) return "LANDLORD";
  throw forbidden("You are not a party of this contract", "notAParty");
}

export async function requireContractParty(contractId: string, userId: string) {
  const [contract] = await db
    .select()
    .from(rentalContracts)
    .where(eq(rentalContracts.id, contractId));
  if (!contract) throw notFound("Contract not found", "contractNotFound");
  const role = roleOf(contract, userId);
  return { contract, role };
}

/**
 * `data` holds the interpolation values for `notifications.bodies[kind]` in
 * the dictionary (see `src/lib/i18n/dictionaries.ts`) — the notification is
 * rendered in the viewer's language when it's read, not at write time.
 */
export async function notify(
  userId: string | null,
  contractId: string,
  kind: (typeof notifications.kind.enumValues)[number],
  data: Record<string, string>,
) {
  if (!userId) return;
  await db.insert(notifications).values({ userId, contractId, kind, data });
}

export function counterpartyId(contract: RentalContract, userId: string) {
  return contract.guarantorId === userId ? contract.landlordId : contract.guarantorId;
}

export function restingStatus(contract: RentalContract): ContractStatus {
  return contract.endDate.getTime() < Date.now() ? "EXPIRED" : "ACTIVE";
}
