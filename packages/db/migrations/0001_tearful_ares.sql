ALTER TABLE "predictions" ADD COLUMN "revealed_text" text;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "revealed_asset" text;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "revealed_direction" integer;