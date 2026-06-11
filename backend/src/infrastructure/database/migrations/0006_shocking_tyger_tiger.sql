ALTER TABLE "stat_events" ADD COLUMN "is_team_rebound" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stat_events" ADD COLUMN "is_bench_foul" boolean DEFAULT false NOT NULL;