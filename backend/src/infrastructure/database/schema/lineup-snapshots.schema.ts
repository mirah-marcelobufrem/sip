import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { games } from './games.schema.js';

export const lineupSnapshots = pgTable('lineup_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  teamId: uuid('team_id').notNull(),
  period: integer('period').notNull(),
  clockTimeSeconds: integer('clock_time_seconds'),
  playerIds: text('player_ids').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type LineupSnapshot = typeof lineupSnapshots.$inferSelect;
export type NewLineupSnapshot = typeof lineupSnapshots.$inferInsert;
