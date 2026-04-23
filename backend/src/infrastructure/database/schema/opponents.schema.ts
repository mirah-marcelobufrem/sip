import { integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const opponentTeams = pgTable('opponent_teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  logo: text('logo'),
  homeCourt: text('home_court'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const opponentPlayers = pgTable('opponent_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  opponentTeamId: uuid('opponent_team_id').notNull().references(() => opponentTeams.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  jerseyNumber: integer('jersey_number'),
  position: text('position'),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  photo: text('photo'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type OpponentTeam = typeof opponentTeams.$inferSelect;
export type NewOpponentTeam = typeof opponentTeams.$inferInsert;
export type OpponentPlayer = typeof opponentPlayers.$inferSelect;
export type NewOpponentPlayer = typeof opponentPlayers.$inferInsert;
