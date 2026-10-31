CREATE TABLE IF NOT EXISTS "ask_payments" (
	"tx_hash" text PRIMARY KEY NOT NULL,
	"payer" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"asked_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
