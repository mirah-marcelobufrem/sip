CREATE TABLE "roster_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roster_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rosters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"season_label" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "home_roster_id" uuid;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "away_roster_id" uuid;--> statement-breakpoint
ALTER TABLE "roster_players" ADD CONSTRAINT "roster_players_roster_id_rosters_id_fk" FOREIGN KEY ("roster_id") REFERENCES "public"."rosters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_players" ADD CONSTRAINT "roster_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roster_players_roster_player_unique" ON "roster_players" USING btree ("roster_id","player_id");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_roster_id_rosters_id_fk" FOREIGN KEY ("home_roster_id") REFERENCES "public"."rosters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_roster_id_rosters_id_fk" FOREIGN KEY ("away_roster_id") REFERENCES "public"."rosters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- U-04 data migration (hand-added, per the 0003/0009 precedent) ----------------
-- One default "Full Squad" roster per team containing all its current players;
-- then backfill every game side to its team's default roster. Zero behavior
-- change day one. Re-run-safe via NOT EXISTS / ON CONFLICT guards.

-- 1) Default roster per (non-deleted) team
INSERT INTO "rosters" (id, team_id, name, is_default, created_at, updated_at)
SELECT gen_random_uuid(), t.id, 'Full Squad', true, now(), now()
FROM "teams" t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "rosters" r
    WHERE r.team_id = t.id AND r.is_default = true AND r.deleted_at IS NULL
  );--> statement-breakpoint

-- 2) Populate each default roster with the team's current players
INSERT INTO "roster_players" (roster_id, player_id)
SELECT r.id, p.id
FROM "rosters" r
JOIN "players" p ON p.team_id = r.team_id AND p.deleted_at IS NULL
WHERE r.is_default = true AND r.deleted_at IS NULL
ON CONFLICT (roster_id, player_id) DO NOTHING;--> statement-breakpoint

-- 3) Backfill game sides to their team's default roster
UPDATE "games" g SET home_roster_id = r.id
FROM "rosters" r
WHERE g.home_roster_id IS NULL AND r.team_id = g.home_team_id
  AND r.is_default = true AND r.deleted_at IS NULL;--> statement-breakpoint
UPDATE "games" g SET away_roster_id = r.id
FROM "rosters" r
WHERE g.away_roster_id IS NULL AND r.team_id = g.away_team_id
  AND r.is_default = true AND r.deleted_at IS NULL;