import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { teams } from './teams.schema.js';
import { opponentTeams } from './opponents.schema.js';
import { tournaments } from './tournaments.schema.js';

export const gameFormatEnum = pgEnum('game_format', ['quarters', 'halves']);
export const gameStatusEnum = pgEnum('game_status', [
  'scheduled',
  'live',
  'completed',
  'cancelled',
]);
export const clockModeEnum = pgEnum('clock_mode', ['display_only', 'countdown', 'none']);

export const gameTemplates = pgTable('game_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  homeTeamId: uuid('home_team_id').references(() => teams.id),
  awayTeamId: uuid('away_team_id').references(() => teams.id),
  homeOpponentTeamId: uuid('home_opponent_team_id').references(() => opponentTeams.id),
  awayOpponentTeamId: uuid('away_opponent_team_id').references(() => opponentTeams.id),
  date: timestamp('date', { withTimezone: true }).notNull(),
  location: text('location'),
  format: gameFormatEnum('format').default('quarters').notNull(),
  numPeriods: integer('num_periods').default(4).notNull(),
  periodDurationMinutes: integer('period_duration_minutes').default(10).notNull(),
  overtimePeriods: integer('overtime_periods').default(0).notNull(),
  foulLimitBonus: integer('foul_limit_bonus').default(5).notNull(),
  threePointEnabled: integer('three_point_enabled').default(1).notNull(),
  clockMode: clockModeEnum('clock_mode').default('display_only').notNull(),
  finalScoreHome: integer('final_score_home'),
  finalScoreAway: integer('final_score_away'),
  currentPeriod: integer('current_period').default(1).notNull(),
  currentClockSeconds: integer('current_clock_seconds'),
  currentPossessionTeamId: uuid('current_possession_team_id').references(() => teams.id),
  possessionArrowTeamId: uuid('possession_arrow_team_id').references(() => teams.id),
  tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'set null' }),
  status: gameStatusEnum('status').default('scheduled').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type GameTemplate = typeof gameTemplates.$inferSelect;
