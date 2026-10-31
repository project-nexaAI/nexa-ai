CREATE TABLE IF NOT EXISTS "kol_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"opted_in" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kol_accounts_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kol_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"kol_id" integer NOT NULL,
	"text" text NOT NULL,
	"asset" text NOT NULL,
	"direction" integer NOT NULL,
	"made_at" timestamp with time zone NOT NULL,
	"matures_at" timestamp with time zone NOT NULL,
	"source_url" text NOT NULL,
	"start_price" numeric(78, 0) NOT NULL,
	"price_decimals" integer NOT NULL,
	"end_price" numeric(78, 0),
	"scored_at" timestamp with time zone,
	"won" boolean,
	"return_bps" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kol_calls" ADD CONSTRAINT "kol_calls_kol_id_kol_accounts_id_fk" FOREIGN KEY ("kol_id") REFERENCES "public"."kol_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kol_calls_kol_idx" ON "kol_calls" USING btree ("kol_id");