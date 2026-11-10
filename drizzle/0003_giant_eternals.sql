ALTER TABLE "rental_contracts" ADD COLUMN "agency_fee_amount" numeric(20, 7);--> statement-breakpoint
ALTER TABLE "rental_contracts" ADD COLUMN "agency_fee_label" text;