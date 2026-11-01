CREATE TABLE IF NOT EXISTS "pro_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"public_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"telegram_dispatched_at" timestamp with time zone,
	CONSTRAINT "pro_alerts_post_id_unique" UNIQUE("post_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pro_payments" (
	"tx_hash" text PRIMARY KEY NOT NULL,
	"payer" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pro_subscriptions" (
	"address" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_link_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_links" (
	"address" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_links_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pro_alerts" ADD CONSTRAINT "pro_alerts_post_id_post_queue_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post_queue"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pro_alerts_dispatch_idx" ON "pro_alerts" USING btree ("telegram_dispatched_at");