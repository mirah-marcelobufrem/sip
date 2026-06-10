CREATE TABLE "possession_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"period" integer NOT NULL,
	"clock_time_seconds" integer NOT NULL,
	"team_id" uuid NOT NULL,
	"start_action_id" uuid,
	"end_action_id" uuid,
	"is_offensive_rebound_continuation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "current_possession_team_id" uuid;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "possession_arrow_team_id" uuid;--> statement-breakpoint
ALTER TABLE "stat_events" ADD COLUMN "linked_action_id" uuid;--> statement-breakpoint
ALTER TABLE "stat_events" ADD COLUMN "link_role" text;--> statement-breakpoint
ALTER TABLE "stat_events" ADD COLUMN "wave_sub_group_id" uuid;--> statement-breakpoint
ALTER TABLE "possession_sequences" ADD CONSTRAINT "possession_sequences_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_sequences" ADD CONSTRAINT "possession_sequences_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_sequences" ADD CONSTRAINT "possession_sequences_start_action_id_stat_events_id_fk" FOREIGN KEY ("start_action_id") REFERENCES "public"."stat_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_sequences" ADD CONSTRAINT "possession_sequences_end_action_id_stat_events_id_fk" FOREIGN KEY ("end_action_id") REFERENCES "public"."stat_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_possession_sequences_game_period_clock" ON "possession_sequences" USING btree ("game_id","period","clock_time_seconds");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_current_possession_team_id_teams_id_fk" FOREIGN KEY ("current_possession_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_possession_arrow_team_id_teams_id_fk" FOREIGN KEY ("possession_arrow_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_events" ADD CONSTRAINT "stat_events_linked_action_id_stat_events_id_fk" FOREIGN KEY ("linked_action_id") REFERENCES "public"."stat_events"("id") ON DELETE cascade ON UPDATE no action;