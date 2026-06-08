ALTER TABLE "stat_events" ADD COLUMN "seq" double precision;
--> statement-breakpoint
UPDATE stat_events SET seq = extract(epoch from created_at) WHERE seq IS NULL;
