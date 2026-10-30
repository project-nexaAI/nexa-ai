CREATE TYPE "public"."cost_category" AS ENUM('llm', 'x_api', 'infra');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('pending_approval', 'approved', 'rejected', 'posted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."prediction_status" AS ENUM('draft', 'committed', 'posted', 'revealed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."price_source" AS ENUM('dex', 'oracle');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" "cost_category" NOT NULL,
	"ref" text NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"usd_micros" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pons_tokens" (
	"address" text PRIMARY KEY NOT NULL,
	"creator" text NOT NULL,
	"name" text,
	"symbol" text,
	"launched_at" timestamp with time zone NOT NULL,
	"graduated_at" timestamp with time zone,
	"creator_tax_bps" integer,
	"top_holder_share_bps" integer,
	"red_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"block_number" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pons_trades" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"trader" text NOT NULL,
	"side" text NOT NULL,
	"token_amount" numeric(78, 0) NOT NULL,
	"quote_amount" numeric(78, 0) NOT NULL,
	"quote_decimals" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"block_number" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"status" "post_status" DEFAULT 'pending_approval' NOT NULL,
	"riskguard" jsonb,
	"prediction_id" integer,
	"scheduled_at" timestamp with time zone,
	"posted_at" timestamp with time zone,
	"external_id" text,
	"mode" text DEFAULT 'dry' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ledger_id" integer,
	"hash" text NOT NULL,
	"status" "prediction_status" DEFAULT 'draft' NOT NULL,
	"commit_tx_hash" text,
	"committed_at" timestamp with time zone,
	"matures_at" timestamp with time zone,
	"preimage_encrypted" text NOT NULL,
	"reveal_tx_hash" text,
	"revealed_at" timestamp with time zone,
	"start_round_id" numeric(78, 0),
	"end_round_id" numeric(78, 0),
	"won" boolean,
	"return_bps" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset" text NOT NULL,
	"source" "price_source" NOT NULL,
	"price" numeric(78, 0) NOT NULL,
	"decimals" integer NOT NULL,
	"round_id" numeric(78, 0),
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "riskguard_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"content_hash" text NOT NULL,
	"allowed" boolean NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requires_approval" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whale_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"decimals" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"block_number" bigint NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_queue" ADD CONSTRAINT "post_queue_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_log_cat_at_idx" ON "cost_log" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pons_tokens_launched_idx" ON "pons_tokens" USING btree ("launched_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pons_trades_token_at_idx" ON "pons_trades" USING btree ("token","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_queue_status_idx" ON "post_queue" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "predictions_hash_uq" ON "predictions" USING btree ("hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "predictions_status_idx" ON "predictions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_snapshots_asset_at_idx" ON "price_snapshots" USING btree ("asset","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whale_transfers_at_idx" ON "whale_transfers" USING btree ("at");