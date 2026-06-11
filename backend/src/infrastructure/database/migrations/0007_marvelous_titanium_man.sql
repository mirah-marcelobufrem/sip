ALTER TABLE "games" ADD COLUMN "tournament_id" uuid;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tournaments_team_name_unique" ON "tournaments" USING btree ("team_id","name");