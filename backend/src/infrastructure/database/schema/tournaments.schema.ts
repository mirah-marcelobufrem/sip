import { integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.schema.js';
import { games } from './games.schema.js';
import { teams } from './teams.schema.js';

export const tournamentFormatEnum = pgEnum('tournament_format', [
  'single_elimination',
  'double_elimination',
  'round_robin',
  'mixed',
]);

export const tournamentStatusEnum = pgEnum('tournament_status', [
  'upcoming',
  'active',
  'completed',
]);

export const tournaments = pgTable(
  'tournaments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    format: tournamentFormatEnum('format').notNull(),
    numTeams: integer('num_teams').notNull(),
    teams: jsonb('teams').$type<TournamentTeamEntry[]>().default([]).notNull(),
    shareToken: text('share_token').unique(),
    status: tournamentStatusEnum('status').default('upcoming').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('tournaments_team_name_unique').on(table.teamId, table.name),
  ],
);

export const tournamentGames = pgTable('tournament_games', {
  id: uuid('id').primaryKey().defaultRandom(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  round: integer('round').notNull(),
  gameId: uuid('game_id').references(() => games.id),
  homeSeed: integer('home_seed'),
  awaySeed: integer('away_seed'),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export interface TournamentTeamEntry {
  seed: number;
  teamId?: string;
  teamName: string;
  wins?: number;
  losses?: number;
  points?: number;
  pointDiff?: number;
}

export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type TournamentGame = typeof tournamentGames.$inferSelect;
