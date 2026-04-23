import { boolean, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.schema.js';

export const sportLevelEnum = pgEnum('sport_level', [
  'youth',
  'high_school',
  'college',
  'pro',
  'recreational',
]);

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  name: text('name').notNull(),
  photo: text('photo'),
  season: text('season'),
  sportLevel: sportLevelEnum('sport_level').default('recreational'),
  homeCourt: text('home_court'),
  primaryColor: text('primary_color').default('#1a56db'),
  secondaryColor: text('secondary_color').default('#ffffff'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
