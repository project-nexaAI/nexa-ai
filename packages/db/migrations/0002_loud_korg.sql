CREATE TABLE IF NOT EXISTS "burns" (
	"id" text PRIMARY KEY NOT NULL,
	"tx_hash" text NOT NULL,
	"nexa_burned" numeric(78, 0) NOT NULL,
	"pair_spent" numeric(78, 0) NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"block_number" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "burns_at_idx" ON "burns" USING btree ("at");