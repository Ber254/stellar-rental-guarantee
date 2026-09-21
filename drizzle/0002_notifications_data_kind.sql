ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."notification_kind";--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('GUARANTEE_RECEIVED', 'GUARANTEE_ACCEPTED', 'GUARANTEE_REJECTED_BY_LANDLORD', 'GUARANTEE_WITHDRAWN', 'GUARANTEE_CANCELLED_UNFUNDED', 'GUARANTEE_EXPIRED', 'GUARANTEE_FUNDED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'RETURN_EXECUTED', 'RETURN_UNILATERAL', 'EXTENSION_PROPOSED', 'EXTENSION_ACCEPTED', 'EXTENSION_CANCELLED');--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE "public"."notification_kind" USING "kind"::"public"."notification_kind";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "data" jsonb;