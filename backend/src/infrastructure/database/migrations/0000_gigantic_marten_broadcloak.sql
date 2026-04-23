CREATE TYPE "public"."development_category" AS ENUM('physical', 'technical', 'tactical', 'mental');--> statement-breakpoint
CREATE TYPE "public"."clock_mode" AS ENUM('display_only', 'countdown', 'none');--> statement-breakpoint
CREATE TYPE "public"."game_format" AS ENUM('quarters', 'halves');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('scheduled', 'live', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('OWNER', 'COACH', 'ASSISTANT', 'SCOUT', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."sport_level" AS ENUM('youth', 'high_school', 'college', 'pro', 'recreational');--> statement-breakpoint
CREATE TYPE "public"."dominant_hand" AS ENUM('L', 'R');--> statement-breakpoint
CREATE TYPE "public"."player_status" AS ENUM('active', 'hidden', 'injured', 'transferred');--> statement-breakpoint
CREATE TYPE "public"."position" AS ENUM('PG', 'SG', 'SF', 'PF', 'C');--> statement-breakpoint
CREATE TYPE "public"."shot_zone" AS ENUM('restricted_area', 'paint', 'mid_range_left', 'mid_range_center', 'mid_range_right', 'left_corner_3', 'left_wing_3', 'top_arc_3', 'right_wing_3', 'right_corner_3', 'backcourt');--> statement-breakpoint
CREATE TYPE "public"."stat_type" AS ENUM('2PM', '2PA', '3PM', '3PA', 'FTM', 'FTA', 'OREB', 'DREB', 'AST', 'TO', 'STL', 'BLK', 'DFD', 'PF', 'TF', 'FF', 'SUB_IN', 'SUB_OUT', 'PERIOD_START', 'PERIOD_END', 'TIMEOUT');--> statement-breakpoint
CREATE TYPE "public"."report_visibility" AS ENUM('private', 'team', 'link');--> statement-breakpoint
CREATE TYPE "public"."scouting_recommendation" AS ENUM('sign', 'monitor', 'pass', 'no_action');--> statement-breakpoint
CREATE TYPE "public"."tournament_format" AS ENUM('single_elimination', 'double_elimination', 'round_robin', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('upcoming', 'active', 'completed');--> statement-breakpoint
CREATE TABLE "development_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"category" "development_category" NOT NULL,
	"metric_name" text NOT NULL,
	"metric_value" real,
	"metric_value_text" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "development_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"coach_user_id" uuid NOT NULL,
	"metric_name" text NOT NULL,
	"target_value" real NOT NULL,
	"target_date" timestamp with time zone,
	"achieved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"home_team_id" uuid,
	"away_team_id" uuid,
	"home_opponent_team_id" uuid,
	"away_opponent_team_id" uuid,
	"date" timestamp with time zone NOT NULL,
	"location" text,
	"format" "game_format" DEFAULT 'quarters' NOT NULL,
	"num_periods" integer DEFAULT 4 NOT NULL,
	"period_duration_minutes" integer DEFAULT 10 NOT NULL,
	"overtime_periods" integer DEFAULT 0 NOT NULL,
	"foul_limit_bonus" integer DEFAULT 5 NOT NULL,
	"three_point_enabled" integer DEFAULT 1 NOT NULL,
	"clock_mode" "clock_mode" DEFAULT 'display_only' NOT NULL,
	"final_score_home" integer,
	"final_score_away" integer,
	"current_period" integer DEFAULT 1 NOT NULL,
	"current_clock_seconds" integer,
	"status" "game_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "team_role" NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_team_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"role" "team_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_team" UNIQUE("user_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"photo" text,
	"season" text,
	"sport_level" "sport_level" DEFAULT 'recreational',
	"home_court" text,
	"primary_color" text DEFAULT '#1a56db',
	"secondary_color" text DEFAULT '#ffffff',
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"jersey_number" integer,
	"position" "position",
	"height_cm" real,
	"weight_kg" real,
	"birth_date" timestamp with time zone,
	"nationality" text,
	"dominant_hand" "dominant_hand",
	"photo" text,
	"status" "player_status" DEFAULT 'active' NOT NULL,
	"injury_date" timestamp with time zone,
	"expected_return" timestamp with time zone,
	"transfer_date" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "opponent_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opponent_team_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"jersey_number" integer,
	"position" text,
	"height_cm" real,
	"weight_kg" real,
	"photo" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "opponent_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo" text,
	"home_court" text,
	"contact_name" text,
	"contact_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stat_event_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"editor_user_id" uuid NOT NULL,
	"original_value" jsonb NOT NULL,
	"new_value" jsonb NOT NULL,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stat_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"period" integer NOT NULL,
	"clock_time_seconds" integer,
	"player_id" uuid,
	"team_id" uuid,
	"stat_type" "stat_type" NOT NULL,
	"value" integer DEFAULT 1 NOT NULL,
	"x_court" real,
	"y_court" real,
	"lineup_snapshot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lineup_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"period" integer NOT NULL,
	"clock_time_seconds" integer,
	"player_ids" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scouting_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid NOT NULL,
	"subject_player_id" uuid,
	"subject_team_id" uuid,
	"game_id" uuid,
	"report_date" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"strengths" text,
	"weaknesses" text,
	"recommendation" "scouting_recommendation",
	"overall_rating" integer,
	"skill_ratings" jsonb,
	"video_links" text[],
	"attachments" text[],
	"visibility" "report_visibility" DEFAULT 'private' NOT NULL,
	"share_token" text,
	"tags" text[],
	"is_opponent_report" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "scouting_reports_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "tournament_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"game_id" uuid,
	"home_seed" integer,
	"away_seed" integer,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"format" "tournament_format" NOT NULL,
	"num_teams" integer NOT NULL,
	"share_token" text,
	"status" "tournament_status" DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tournaments_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "development_entries" ADD CONSTRAINT "development_entries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_entries" ADD CONSTRAINT "development_entries_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_goals" ADD CONSTRAINT "development_goals_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_goals" ADD CONSTRAINT "development_goals_coach_user_id_users_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_opponent_team_id_opponent_teams_id_fk" FOREIGN KEY ("home_opponent_team_id") REFERENCES "public"."opponent_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_opponent_team_id_opponent_teams_id_fk" FOREIGN KEY ("away_opponent_team_id") REFERENCES "public"."opponent_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_team_roles" ADD CONSTRAINT "user_team_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opponent_players" ADD CONSTRAINT "opponent_players_opponent_team_id_opponent_teams_id_fk" FOREIGN KEY ("opponent_team_id") REFERENCES "public"."opponent_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_events" ADD CONSTRAINT "stat_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_snapshots" ADD CONSTRAINT "lineup_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scouting_reports" ADD CONSTRAINT "scouting_reports_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_games" ADD CONSTRAINT "tournament_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;