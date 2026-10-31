CREATE TABLE IF NOT EXISTS "ask_credit_uses" (
	"id" serial PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"month" text NOT NULL,
	"asked_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ask_credit_uses_idx" ON "ask_credit_uses" USING btree ("address","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_sessions_address_idx" ON "auth_sessions" USING btree ("address");