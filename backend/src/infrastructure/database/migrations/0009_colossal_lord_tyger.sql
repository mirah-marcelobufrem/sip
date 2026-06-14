-- U-01/U-02/U-03 — One Team Universe.
-- Hand-ordered (per the 0003 data-migration precedent): schema additions →
-- data moves (UUID-preserving) → constraint tightening → column drops. The
-- backfills MUST run before SET NOT NULL / DROP COLUMN, so the drizzle-generated
-- statement order is reordered below. opponent_* tables are kept (read-only)
-- one release as a safety net, then dropped.

-- 1) Additive schema -----------------------------------------------------------
CREATE TYPE "public"."team_kind" AS ENUM('managed', 'external');--> statement-breakpoint
CREATE TABLE "tournament_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"seed" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "kind" "team_kind" DEFAULT 'managed' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_teams_tournament_team_unique" ON "tournament_teams" USING btree ("tournament_id","team_id");--> statement-breakpoint

-- 2) Data move: opponent_teams → teams (preserve UUIDs; logo→photo) -------------
INSERT INTO "teams" (id, kind, created_by_user_id, name, photo, home_court, contact_name, contact_email, active, created_at, updated_at, deleted_at)
SELECT id, 'external', created_by_user_id, name, logo, home_court, contact_name, contact_email, true, created_at, updated_at, deleted_at
FROM "opponent_teams"
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint

-- 3) Data move: opponent_players → players (preserve UUIDs; coerce position enum)
INSERT INTO "players" (id, team_id, first_name, last_name, jersey_number, position, height_cm, weight_kg, photo, status, notes, created_at, updated_at, deleted_at)
SELECT id, opponent_team_id, first_name, last_name, jersey_number,
       CASE WHEN position IN ('PG','SG','SF','PF','C') THEN position::"public"."position" ELSE NULL END,
       height_cm, weight_kg, photo, 'active', notes, created_at, updated_at, deleted_at
FROM "opponent_players"
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint

-- 4) games: backfill team ids from the (now-migrated) opponent columns ----------
UPDATE "games" SET away_team_id = away_opponent_team_id WHERE away_team_id IS NULL AND away_opponent_team_id IS NOT NULL;--> statement-breakpoint
UPDATE "games" SET home_team_id = home_opponent_team_id WHERE home_team_id IS NULL AND home_opponent_team_id IS NOT NULL;--> statement-breakpoint

-- 5) games with no away team: find-or-create an external team from notes
--    (owned by the home team's OWNER), defaulting to "Unknown Opponent".
INSERT INTO "teams" (id, kind, created_by_user_id, name, active, created_at, updated_at)
SELECT gen_random_uuid(), 'external', src.owner_id, src.team_name, true, now(), now()
FROM (
  SELECT DISTINCT
    COALESCE(NULLIF(btrim(g.notes), ''), 'Unknown Opponent') AS team_name,
    (SELECT utr.user_id FROM "user_team_roles" utr
       WHERE utr.team_id = g.home_team_id
       ORDER BY CASE WHEN utr.role = 'OWNER' THEN 0 ELSE 1 END
       LIMIT 1) AS owner_id
  FROM "games" g
  WHERE g.away_team_id IS NULL
) src
WHERE NOT EXISTS (
  SELECT 1 FROM "teams" t
  WHERE t.kind = 'external' AND t.name = src.team_name
    AND t.created_by_user_id IS NOT DISTINCT FROM src.owner_id
    AND t.deleted_at IS NULL
);--> statement-breakpoint
UPDATE "games" g SET away_team_id = t.id
FROM "teams" t
WHERE g.away_team_id IS NULL
  AND t.kind = 'external'
  AND t.deleted_at IS NULL
  AND t.name = COALESCE(NULLIF(btrim(g.notes), ''), 'Unknown Opponent')
  AND t.created_by_user_id IS NOT DISTINCT FROM (
    SELECT utr.user_id FROM "user_team_roles" utr
      WHERE utr.team_id = g.home_team_id
      ORDER BY CASE WHEN utr.role = 'OWNER' THEN 0 ELSE 1 END
      LIMIT 1);--> statement-breakpoint

-- 6) Absolute fallback for any game still missing a side (e.g. home team had no
--    user_team_roles, or a null home team): a global "Unknown Opponent".
INSERT INTO "teams" (id, kind, created_by_user_id, name, active, created_at, updated_at)
SELECT gen_random_uuid(), 'external', NULL, 'Unknown Opponent', true, now(), now()
WHERE EXISTS (SELECT 1 FROM "games" WHERE away_team_id IS NULL OR home_team_id IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "teams" WHERE kind = 'external' AND name = 'Unknown Opponent' AND created_by_user_id IS NULL AND deleted_at IS NULL);--> statement-breakpoint
UPDATE "games" SET away_team_id = (SELECT id FROM "teams" WHERE kind = 'external' AND name = 'Unknown Opponent' AND created_by_user_id IS NULL AND deleted_at IS NULL LIMIT 1) WHERE away_team_id IS NULL;--> statement-breakpoint
UPDATE "games" SET home_team_id = (SELECT id FROM "teams" WHERE kind = 'external' AND name = 'Unknown Opponent' AND created_by_user_id IS NULL AND deleted_at IS NULL LIMIT 1) WHERE home_team_id IS NULL;--> statement-breakpoint

-- 7) tournament_teams backfill from the JSONB entries that carry a team id ------
INSERT INTO "tournament_teams" (tournament_id, team_id, seed)
SELECT t.id, (elem->>'teamId')::uuid, COALESCE((elem->>'seed')::int, 0)
FROM "tournaments" t, jsonb_array_elements(t.teams) elem
WHERE elem->>'teamId' IS NOT NULL
  AND EXISTS (SELECT 1 FROM "teams" tm WHERE tm.id = (elem->>'teamId')::uuid)
ON CONFLICT (tournament_id, team_id) DO NOTHING;--> statement-breakpoint

-- 8) Constraint tightening + drop legacy game columns (after backfill) ----------
ALTER TABLE "games" ALTER COLUMN "home_team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "away_team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_home_opponent_team_id_opponent_teams_id_fk";--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT IF EXISTS "games_away_opponent_team_id_opponent_teams_id_fk";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "home_opponent_team_id";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "away_opponent_team_id";
