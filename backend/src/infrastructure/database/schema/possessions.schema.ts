import { boolean, index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { games } from './games.schema.js';
import { teams } from './teams.schema.js';
import { statEvents } from './stat-events.schema.js';

export const possessionSequences = pgTable(
  'possession_sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id').notNull().references(() => games.id),
    period: integer('period').notNull(),
    clockTimeSeconds: integer('clock_time_seconds').notNull(),
    teamId: uuid('team_id').notNull().references(() => teams.id),
    startActionId: uuid('start_action_id').references(() => statEvents.id),
    endActionId: uuid('end_action_id').references(() => statEvents.id),
    isOffensiveReboundContinuation: boolean('is_offensive_rebound_continuation')
      .default(false)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_possession_sequences_game_period_clock').on(
      table.gameId,
      table.period,
      table.clockTimeSeconds,
    ),
  ],
);

export type PossessionSequenceRow = typeof possessionSequences.$inferSelect;
export type NewPossessionSequenceRow = typeof possessionSequences.$inferInsert;
