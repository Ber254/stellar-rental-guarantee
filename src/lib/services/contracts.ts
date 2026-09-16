import { randomBytes } from "node:crypto";

import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  agreements,
  blockchainTransactions,
  contractCounters,
  guarantees,
  notifications,
  properties,
  proposals,
  rentalContracts,
  users,
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
    propertyLabel: z.string().min(2).max(120),
    propertyAddress: z.string().min(4).max(240),
    landlordName: z.string().min(2).max(120),
    landlordEmail: z.email().optional().or(z.literal("")),
    landlordWallet: z.string().regex(STELLAR_ADDRESS, "Invalid Stellar address"),
    tenantWallet: z.string().regex(STELLAR_ADDRESS, "Invalid Stellar address"),
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
  })
  .refine((value) => value.landlordWallet !== value.tenantWallet, {
    message: "Tenant and landlord wallets must be different",
    path: ["landlordWallet"],
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
  return `RG-${year}-${String(row.lastNumber).padStart(6, "0")}`;
}

export async function createRentalContract(
  tenant: User,
  input: CreateContractInput,
) {
  const [property] = await db
    .insert(properties)
    .values({
      label: input.propertyLabel,
      address: input.propertyAddress,
      createdBy: tenant.id,
    })
    .returning();

  const reference = await nextReference();
  const inviteToken = randomBytes(24).toString("base64url");

  const [contract] = await db
    .insert(rentalContracts)
    .values({
      reference,
      propertyId: property.id,
      tenantId: tenant.id,
      landlordName: input.landlordName,
      landlordEmail: input.landlordEmail || null,
      tenantWallet: input.tenantWallet,
      landlordWallet: input.landlordWallet,
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

  if (!tenant.stellarAddress) {
    await db
      .update(users)
      .set({ stellarAddress: input.tenantWallet })
      .where(eq(users.id, tenant.id));
  }

  return contract;
}

export async function acceptInvitation(landlord: User, inviteToken: string) {
  const [contract] = await db
    .select()
    .from(rentalContracts)
    .where(eq(rentalContracts.inviteToken, inviteToken));

  if (!contract) throw notFound("Invitation not found");
  if (contract.tenantId === landlord.id) {
    throw badRequest("The tenant cannot accept their own contract");
  }
  if (contract.landlordId && contract.landlordId !== landlord.id) {
    throw forbidden("This contract was already accepted by another landlord");
  }
  if (contract.status !== "PENDING_ACCEPTANCE") {
    return contract;
  }

  assertTransition(contract.status, "AWAITING_FUNDING");

  const [updated] = await db
    .update(rentalContracts)
    .set({
      landlordId: landlord.id,
      status: "AWAITING_FUNDING",
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(rentalContracts.id, contract.id))
    .returning();

  if (!landlord.stellarAddress) {
    await db
      .update(users)
      .set({ stellarAddress: contract.landlordWallet })
      .where(eq(users.id, landlord.id));
  }

  await notify(
    contract.tenantId,
    contract.id,
    "Landlord accepted the contract",
    `${landlord.name} accepted ${contract.reference}. You can now fund the guarantee.`,
  );

  return updated;
}

export async function listContracts(userId: string) {
  return db
    .select({
      contract: rentalContracts,
      property: properties,
      guarantee: guarantees,
    })
    .from(rentalContracts)
    .innerJoin(properties, eq(properties.id, rentalContracts.propertyId))
    .leftJoin(guarantees, eq(guarantees.contractId, rentalContracts.id))
    .where(
      or(
        eq(rentalContracts.tenantId, userId),
        eq(rentalContracts.landlordId, userId),
      ),
    )
    .orderBy(desc(rentalContracts.createdAt));
}

export async function getContractForUser(contractId: string, userId: string) {
  const [row] = await db
    .select({
      contract: rentalContracts,
      property: properties,
      guarantee: guarantees,
    })
    .from(rentalContracts)
    .innerJoin(properties, eq(properties.id, rentalContracts.propertyId))
    .leftJoin(guarantees, eq(guarantees.contractId, rentalContracts.id))
    .where(eq(rentalContracts.id, contractId));

  if (!row) throw notFound("Contract not found");
  if (row.contract.tenantId !== userId && row.contract.landlordId !== userId) {
    throw forbidden("You are not a party of this contract");
  }
  return row;
}

export async function getContractDetail(contractId: string, userId: string) {
  const row = await getContractForUser(contractId, userId);

  const [tenant] = await db
    .select()
    .from(users)
    .where(eq(users.id, row.contract.tenantId));
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
    .where(eq(agreements.contractId, contractId));

  const transactions = await db
    .select()
    .from(blockchainTransactions)
    .where(eq(blockchainTransactions.contractId, contractId))
    .orderBy(desc(blockchainTransactions.createdAt));

  return {
    ...row,
    tenant,
    landlord,
    proposals: proposalRows,
    agreement: agreement ?? null,
    transactions,
    role: roleOf(row.contract, userId),
  };
}

export function roleOf(contract: RentalContract, userId: string): PartyRole {
  if (contract.tenantId === userId) return "TENANT";
  if (contract.landlordId === userId) return "LANDLORD";
  throw forbidden("You are not a party of this contract");
}

export async function requireContractParty(contractId: string, userId: string) {
  const [contract] = await db
    .select()
    .from(rentalContracts)
    .where(eq(rentalContracts.id, contractId));
  if (!contract) throw notFound("Contract not found");
  const role = roleOf(contract, userId);
  return { contract, role };
}

export async function notify(
  userId: string | null,
  contractId: string,
  title: string,
  body: string,
) {
  if (!userId) return;
  await db.insert(notifications).values({ userId, contractId, title, body });
}

export async function counterpartyId(contract: RentalContract, userId: string) {
  return contract.tenantId === userId ? contract.landlordId : contract.tenantId;
}

export async function findContractByInvite(inviteToken: string) {
  const [row] = await db
    .select({ contract: rentalContracts, property: properties })
    .from(rentalContracts)
    .innerJoin(properties, eq(properties.id, rentalContracts.propertyId))
    .where(
      and(
        eq(rentalContracts.inviteToken, inviteToken),
        eq(rentalContracts.status, "PENDING_ACCEPTANCE"),
      ),
    );
  return row ?? null;
}
