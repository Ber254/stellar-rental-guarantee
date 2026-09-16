CREATE TYPE "public"."contract_status" AS ENUM('DRAFT', 'PENDING_ACCEPTANCE', 'AWAITING_FUNDING', 'ACTIVE', 'RETURN_REQUESTED', 'NEGOTIATION', 'AGREED', 'RELEASED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."guarantee_status" AS ENUM('CREATED', 'LOCKED', 'RELEASED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."party_role" AS ENUM('TENANT', 'LANDLORD');--> statement-breakpoint
CREATE TYPE "public"."proposal_action" AS ENUM('PROPOSE', 'ACCEPT', 'REJECT', 'COUNTER');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."tx_kind" AS ENUM('CREATE_GUARANTEE', 'FUND_GUARANTEE', 'REQUEST_RELEASE', 'PROPOSE_DISTRIBUTION', 'ACCEPT_PROPOSAL', 'RELEASE_FUNDS', 'CANCEL_GUARANTEE');--> statement-breakpoint
CREATE TYPE "public"."tx_status" AS ENUM('PENDING', 'SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"to_landlord" numeric(20, 7) NOT NULL,
	"to_tenant" numeric(20, 7) NOT NULL,
	"tenant_accepted_at" timestamp with time zone,
	"landlord_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blockchain_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"kind" "tx_kind" NOT NULL,
	"status" "tx_status" DEFAULT 'PENDING' NOT NULL,
	"tx_hash" text,
	"ledger" integer,
	"network" text DEFAULT 'testnet' NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"amount" numeric(20, 7),
	"source_address" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guarantees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"amount" numeric(20, 7) NOT NULL,
	"asset_code" text DEFAULT 'USDC' NOT NULL,
	"on_chain_id" text NOT NULL,
	"soroban_contract_id" text,
	"status" "guarantee_status" DEFAULT 'CREATED' NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"funded_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contract_id" uuid,
	"title" text NOT NULL,
	"body" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_role" "party_role" NOT NULL,
	"action" "proposal_action" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"proposed_by" uuid NOT NULL,
	"proposed_by_role" "party_role" NOT NULL,
	"to_landlord" numeric(20, 7) NOT NULL,
	"to_tenant" numeric(20, 7) NOT NULL,
	"reason" text,
	"status" "proposal_status" DEFAULT 'PENDING' NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"property_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"landlord_id" uuid,
	"landlord_name" text NOT NULL,
	"landlord_email" text,
	"tenant_wallet" text NOT NULL,
	"landlord_wallet" text NOT NULL,
	"guarantee_amount" numeric(20, 7) NOT NULL,
	"rent_amount" numeric(20, 7),
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"notes" text,
	"status" "contract_status" DEFAULT 'DRAFT' NOT NULL,
	"invite_token" text NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"stellar_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_contract_id_rental_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."rental_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ADD CONSTRAINT "blockchain_transactions_contract_id_rental_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."rental_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantees" ADD CONSTRAINT "guarantees_contract_id_rental_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."rental_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_contract_id_rental_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."rental_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_actions" ADD CONSTRAINT "proposal_actions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_actions" ADD CONSTRAINT "proposal_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_contract_id_rental_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."rental_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_landlord_id_users_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreements_contract_unique" ON "agreements" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "blockchain_transactions_contract_idx" ON "blockchain_transactions" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guarantees_contract_unique" ON "guarantees" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guarantees_on_chain_id_unique" ON "guarantees" USING btree ("on_chain_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "proposal_actions_proposal_idx" ON "proposal_actions" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposals_contract_idx" ON "proposals" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_contracts_reference_unique" ON "rental_contracts" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_contracts_invite_token_unique" ON "rental_contracts" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX "rental_contracts_tenant_idx" ON "rental_contracts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "rental_contracts_landlord_idx" ON "rental_contracts" USING btree ("landlord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");