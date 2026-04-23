import { integer, pgEnum, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { teams } from './teams.schema.js';

export const positionEnum = pgEnum('position', ['PG', 'SG', 'SF', 'PF', 'C']);
export const dominantHandEnum = pgEnum('dominant_hand', ['L', 'R']);
export const playerStatusEnum = pgEnum('player_status', [
  'active',
  'hidden',
  'injured',
  'transferred',
]);

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  jerseyNumber: integer('jersey_number'),
  position: positionEnum('position'),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  birthDate: timestamp('birth_date', { withTimezone: true }),
  nationality: text('nationality'),
  dominantHand: dominantHandEnum('dominant_hand'),
  photo: text('photo'),
  status: playerStatusEnum('status').default('active').notNull(),
  injuryDate: timestamp('injury_date', { withTimezone: true }),
  expectedReturn: timestamp('expected_return', { withTimezone: true }),
  transferDate: timestamp('transfer_date', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
