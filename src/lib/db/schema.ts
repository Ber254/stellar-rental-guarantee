import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const contractStatusEnum = pgEnum("contract_status", [
  "DRAFT",
  "PENDING_ACCEPTANCE",
  "AWAITING_FUNDING",
  "ACTIVE",
  "RETURN_REQUESTED",
  "NEGOTIATION",
  "AGREED",
  "RELEASED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
]);

export const partyRoleEnum = pgEnum("party_role", ["GUARANTOR", "LANDLORD"]);

export const proposalKindEnum = pgEnum("proposal_kind", [
  "SETTLEMENT",
  "UNILATERAL_RETURN",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
]);

export const proposalActionEnum = pgEnum("proposal_action", [
  "PROPOSE",
  "ACCEPT",
  "REJECT",
  "COUNTER",
]);

export const extensionStatusEnum = pgEnum("extension_status", [
  "PENDING",
  "ACCEPTED",
  "CANCELLED",
]);

export const txKindEnum = pgEnum("tx_kind", [
  "CREATE_GUARANTEE",
  "FUND_GUARANTEE",
  "CANCEL_GUARANTEE",
  "PROPOSE_SETTLEMENT",
  "ACCEPT_SETTLEMENT",
  "REJECT_SETTLEMENT",
  "EXECUTE_SETTLEMENT",
  "RETURN_TO_GUARANTOR",
  "PROPOSE_EXTENSION",
  "ACCEPT_EXTENSION",
  "CANCEL_EXTENSION",
]);

export const txStatusEnum = pgEnum("tx_status", [
  "PENDING",
  "SUCCESS",
  "FAILED",
]);

export const guaranteeStatusEnum = pgEnum("guarantee_status", [
  "CREATED",
  "LOCKED",
  "RELEASED",
  "CANCELLED",
]);

export const notificationKindEnum = pgEnum("notification_kind", [
  "GUARANTEE_RECEIVED",
  "GUARANTEE_ACCEPTED",
  "GUARANTEE_REJECTED",
  "GUARANTEE_EXPIRED",
  "GUARANTEE_FUNDED",
  "RETURN_REQUESTED",
  "RETURN_APPROVED",
  "RETURN_REJECTED",
  "RETURN_UNILATERAL",
  "EXTENSION_PROPOSED",
  "EXTENSION_ACCEPTED",
  "EXTENSION_CANCELLED",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    lastName: text("last_name"),
    photoUrl: text("photo_url"),
    alias: text("alias"),
    passwordHash: text("password_hash").notNull(),
    stellarAddress: text("stellar_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_alias_unique").on(table.alias),
  ],
);

export const userAliasHistory = pgTable(
  "user_alias_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("user_alias_history_user_idx").on(table.userId)],
);

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  address: text("address").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const rentalContracts = pgTable(
  "rental_contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "restrict",
    }),
    guarantorId: uuid("guarantor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    landlordId: uuid("landlord_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    guarantorWallet: text("guarantor_wallet").notNull(),
    landlordWallet: text("landlord_wallet"),
    guaranteeAmount: numeric("guarantee_amount", {
      precision: 20,
      scale: 7,
    }).notNull(),
    rentAmount: numeric("rent_amount", { precision: 20, scale: 7 }),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    notes: text("notes"),
    status: contractStatusEnum("status").notNull().default("DRAFT"),
    rejectionReason: text("rejection_reason"),
    inviteToken: text("invite_token").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("rental_contracts_reference_unique").on(table.reference),
    uniqueIndex("rental_contracts_invite_token_unique").on(table.inviteToken),
    index("rental_contracts_guarantor_idx").on(table.guarantorId),
    index("rental_contracts_landlord_idx").on(table.landlordId),
  ],
);

export const guarantees = pgTable(
  "guarantees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => rentalContracts.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 20, scale: 7 }).notNull(),
    lockedAmount: numeric("locked_amount", { precision: 20, scale: 7 }),
    fundedAmount: numeric("funded_amount", { precision: 20, scale: 7 }),
    assetCode: text("asset_code").notNull().default("USDC"),
    onChainId: text("on_chain_id").notNull(),
    sorobanContractId: text("soroban_contract_id"),
    status: guaranteeStatusEnum("status").notNull().default("CREATED"),
    simulated: boolean("simulated").notNull().default(false),
    fundedAt: timestamp("funded_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("guarantees_contract_unique").on(table.contractId),
    uniqueIndex("guarantees_on_chain_id_unique").on(table.onChainId),
  ],
);

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => rentalContracts.id, { onDelete: "cascade" }),
    kind: proposalKindEnum("kind").notNull().default("SETTLEMENT"),
    proposedBy: uuid("proposed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    proposedByRole: partyRoleEnum("proposed_by_role").notNull(),
    toGuarantor: numeric("to_guarantor", { precision: 20, scale: 7 }).notNull(),
    toLandlord: numeric("to_landlord", { precision: 20, scale: 7 }).notNull(),
    reason: text("reason"),
    status: proposalStatusEnum("status").notNull().default("PENDING"),
    round: integer("round").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("proposals_contract_idx").on(table.contractId)],
);

export const proposalActions = pgTable(
  "proposal_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    actorRole: partyRoleEnum("actor_role").notNull(),
    action: proposalActionEnum("action").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("proposal_actions_proposal_idx").on(table.proposalId)],
);

export const agreements = pgTable(
  "agreements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => rentalContracts.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "restrict" }),
    toGuarantor: numeric("to_guarantor", { precision: 20, scale: 7 }).notNull(),
    toLandlord: numeric("to_landlord", { precision: 20, scale: 7 }).notNull(),
    feeAmount: numeric("fee_amount", { precision: 20, scale: 7 }),
    guarantorAcceptedAt: timestamp("guarantor_accepted_at", {
      withTimezone: true,
    }),
    landlordAcceptedAt: timestamp("landlord_accepted_at", {
      withTimezone: true,
    }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("agreements_contract_idx").on(table.contractId)],
);

export const extensions = pgTable(
  "extensions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => rentalContracts.id, { onDelete: "cascade" }),
    proposedNewEndDate: timestamp("proposed_new_end_date", {
      withTimezone: true,
    }).notNull(),
    proposedNewAmount: numeric("proposed_new_amount", {
      precision: 20,
      scale: 7,
    }).notNull(),
    topUpAmount: numeric("top_up_amount", { precision: 20, scale: 7 })
      .notNull()
      .default("0"),
    refundAmount: numeric("refund_amount", { precision: 20, scale: 7 })
      .notNull()
      .default("0"),
    status: extensionStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [index("extensions_contract_idx").on(table.contractId)],
);

export const blockchainTransactions = pgTable(
  "blockchain_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => rentalContracts.id, { onDelete: "cascade" }),
    kind: txKindEnum("kind").notNull(),
    status: txStatusEnum("status").notNull().default("PENDING"),
    txHash: text("tx_hash"),
    ledger: integer("ledger"),
    network: text("network").notNull().default("testnet"),
    simulated: boolean("simulated").notNull().default(false),
    amount: numeric("amount", { precision: 20, scale: 7 }),
    sourceAddress: text("source_address"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("blockchain_transactions_contract_idx").on(table.contractId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => rentalContracts.id, {
      onDelete: "cascade",
    }),
    kind: notificationKindEnum("kind"),
    template: text("template"),
    params: jsonb("params").$type<Record<string, string>>(),
    title: text("title").notNull(),
    body: text("body"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("notifications_user_idx").on(table.userId)],
);

export const contractCounters = pgTable("contract_counters", {
  year: integer("year").primaryKey(),
  lastNumber: integer("last_number").notNull().default(0),
});

export type User = typeof users.$inferSelect;
export type RentalContract = typeof rentalContracts.$inferSelect;
export type Guarantee = typeof guarantees.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type Agreement = typeof agreements.$inferSelect;
export type Extension = typeof extensions.$inferSelect;
export type BlockchainTransaction = typeof blockchainTransactions.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type ContractStatus = RentalContract["status"];
export type PartyRole = Proposal["proposedByRole"];
