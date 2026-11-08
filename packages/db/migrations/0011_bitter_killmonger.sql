CREATE INDEX IF NOT EXISTS "pons_tokens_curve_idx" ON "pons_tokens" USING btree ("curve");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pons_trades_at_idx" ON "pons_trades" USING btree ("at");