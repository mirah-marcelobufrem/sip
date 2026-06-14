import { boolean, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.schema.js';
import { users } from './users.schema.js';

export const sportLevelEnum = pgEnum('sport_level', [
  'youth',
  'high_school',
  'college',
  'pro',
  'recreational',
]);

// U-01 — one team universe. 'managed' teams are governed by user_team_roles
// (your club). 'external' (scouted) teams are owned via created_by_user_id —
// mirrors the retired opponent_teams ownership scoping (v1.6.1).
export const teamKindEnum = pgEnum('team_kind', ['managed', 'external']);

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  kind: teamKindEnum('kind').default('managed').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  name: text('name').notNull(),
  photo: text('photo'),
  season: text('season'),
  sportLevel: sportLevelEnum('sport_level').default('recreational'),
  homeCourt: text('home_court'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  primaryColor: text('primary_color').default('#1a56db'),
  secondaryColor: text('secondary_color').default('#ffffff'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
