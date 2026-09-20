CREATE TYPE "public"."extension_status" AS ENUM('PENDING', 'ACCEPTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('GUARANTEE_RECEIVED', 'GUARANTEE_ACCEPTED', 'GUARANTEE_REJECTED', 'GUARANTEE_EXPIRED', 'GUARANTEE_FUNDED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'RETURN_UNILATERAL', 'EXTENSION_PROPOSED', 'EXTENSION_ACCEPTED', 'EXTENSION_CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."proposal_kind" AS ENUM('SETTLEMENT', 'UNILATERAL_RETURN');--> statement-breakpoint
ALTER TYPE "public"."contract_status" ADD VALUE 'REJECTED';--> statement-breakpoint
ALTER TYPE "public"."contract_status" ADD VALUE 'EXPIRED';--> statement-breakpoint
CREATE TABLE "extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"proposed_new_end_date" timestamp with time zone NOT NULL,
	"proposed_new_amount" numeric(20, 7) NOT NULL,
	"top_up_amount" numeric(20, 7) DEFAULT '0' NOT NULL,
	"refund_amount" numeric(20, 7) DEFAULT '0' NOT NULL,
	"status" "extension_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_alias_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rental_contracts" DROP CONSTRAINT "rental_contracts_tenant_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "rental_contracts" DROP CONSTRAINT "rental_contracts_landlord_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "proposal_actions" ALTER COLUMN "actor_role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "proposed_by_role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."party_role";--> statement-breakpoint
CREATE TYPE "public"."party_role" AS ENUM('GUARANTOR', 'LANDLORD');--> statement-breakpoint
ALTER TABLE "proposal_actions" ALTER COLUMN "actor_role" SET DATA TYPE "public"."party_role" USING "actor_role"::"public"."party_role";--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "proposed_by_role" SET DATA TYPE "public"."party_role" USING "proposed_by_role"::"public"."party_role";--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."tx_kind";--> statement-breakpoint
CREATE TYPE "public"."tx_kind" AS ENUM('CREATE_GUARANTEE', 'FUND_GUARANTEE', 'CANCEL_GUARANTEE', 'PROPOSE_SETTLEMENT', 'ACCEPT_SETTLEMENT', 'REJECT_SETTLEMENT', 'EXECUTE_SETTLEMENT', 'RETURN_TO_GUARANTOR', 'PROPOSE_EXTENSION', 'ACCEPT_EXTENSION', 'CANCEL_EXTENSION');--> statement-breakpoint
ALTER TABLE "blockchain_transactions" ALTER COLUMN "kind" SET DATA TYPE "public"."tx_kind" USING "kind"::"public"."tx_kind";--> statement-breakpoint
DROP INDEX "agreements_contract_unique";--> statement-breakpoint
DROP INDEX "rental_contracts_tenant_idx";--> statement-breakpoint
ALTER TABLE "rental_contracts" ALTER COLUMN "property_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_contracts" ALTER COLUMN "landlord_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_contracts" ALTER COLUMN "landlord_wallet" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agreements" ADD COLUMN "to_guarantor" numeric(20, 7) NOT NULL;--> statement-breakpoint
ALTER TABLE "agreements" ADD COLUMN "fee_amount" numeric(20, 7);--> statement-breakpoint
ALTER TABLE "agreements" ADD COLUMN "guarantor_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agreements" ADD COLUMN "executed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guarantees" ADD COLUMN "locked_amount" numeric(20, 7);--> statement-breakpoint
ALTER TABLE "guarantees" ADD COLUMN "funded_amount" numeric(20, 7);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "kind" "notification_kind";--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "kind" "proposal_kind" DEFAULT 'SETTLEMENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "to_guarantor" numeric(20, 7) NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_contracts" ADD COLUMN "guarantor_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_contracts" ADD COLUMN "guarantor_wallet" text NOT NULL;--> statement-breakpoint
ALTER TABLE "rental_contracts" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "rental_contracts" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "alias" text;--> statement-breakpoint
ALTER TABLE "extensions" ADD CONSTRAINT "extensions_contract_id_rental_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."rental_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_alias_history" ADD CONSTRAINT "user_alias_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extensions_contract_idx" ON "extensions" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "user_alias_history_user_idx" ON "user_alias_history" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_guarantor_id_users_id_fk" FOREIGN KEY ("guarantor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_landlord_id_users_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agreements_contract_idx" ON "agreements" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "rental_contracts_guarantor_idx" ON "rental_contracts" USING btree ("guarantor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_alias_unique" ON "users" USING btree ("alias");--> statement-breakpoint
ALTER TABLE "agreements" DROP COLUMN "to_tenant";--> statement-breakpoint
ALTER TABLE "agreements" DROP COLUMN "tenant_accepted_at";--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "to_tenant";--> statement-breakpoint
ALTER TABLE "rental_contracts" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "rental_contracts" DROP COLUMN "landlord_name";--> statement-breakpoint
ALTER TABLE "rental_contracts" DROP COLUMN "landlord_email";--> statement-breakpoint
ALTER TABLE "rental_contracts" DROP COLUMN "tenant_wallet";