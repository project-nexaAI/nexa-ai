CREATE TABLE IF NOT EXISTS "indexer_state" (
	"name" text PRIMARY KEY NOT NULL,
	"last_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pons_tokens" ADD COLUMN "curve" text;--> statement-breakpoint
ALTER TABLE "pons_tokens" ADD COLUMN "pair_token" text;