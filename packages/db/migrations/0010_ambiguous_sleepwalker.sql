CREATE TABLE IF NOT EXISTS "sponsored_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"client" text NOT NULL,
	"token" text NOT NULL,
	"payment_ref" text NOT NULL,
	"post_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_queue" ADD COLUMN "reply_to" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsored_reports" ADD CONSTRAINT "sponsored_reports_post_id_post_queue_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post_queue"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
