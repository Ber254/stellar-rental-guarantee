ALTER TABLE "notifications" ADD COLUMN "template" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "params" jsonb;