import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { players } from './players.schema.js';
import { teams } from './teams.schema.js';

// U-04 (R3–R6) — a team has N rosters; a roster belongs to exactly one team;
// a player may appear on 1..N rosters of THEIR team (R6 enforced in the use
// case: player.teamId === roster.teamId). Every game side references a roster.
export const rosters = pgTable('rosters', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  name: text('name').notNull(),
  seasonLabel: text('season_label'),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const rosterPlayers = pgTable(
  'roster_players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rosterId: uuid('roster_id').notNull().references(() => rosters.id),
    playerId: uuid('player_id').notNull().references(() => players.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    rosterPlayerUnique: uniqueIndex('roster_players_roster_player_unique').on(
      t.rosterId,
      t.playerId,
    ),
  }),
);

export type Roster = typeof rosters.$inferSelect;
export type NewRoster = typeof rosters.$inferInsert;
export type RosterPlayer = typeof rosterPlayers.$inferSelect;
export type NewRosterPlayer = typeof rosterPlayers.$inferInsert;
