import { pgEnum, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { players } from './players.schema.js';
import { users } from './users.schema.js';

export const developmentCategoryEnum = pgEnum('development_category', [
  'physical',
  'technical',
  'tactical',
  'mental',
]);

export const developmentEntries = pgTable('development_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  coachUserId: uuid('coach_user_id').notNull().references(() => users.id),
  date: timestamp('date', { withTimezone: true }).notNull(),
  category: developmentCategoryEnum('category').notNull(),
  metricName: text('metric_name').notNull(),
  metricValue: real('metric_value'),
  metricValueText: text('metric_value_text'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const developmentGoals = pgTable('development_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  coachUserId: uuid('coach_user_id').notNull().references(() => users.id),
  metricName: text('metric_name').notNull(),
  targetValue: real('target_value').notNull(),
  targetDate: timestamp('target_date', { withTimezone: true }),
  achievedAt: timestamp('achieved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type DevelopmentEntry = typeof developmentEntries.$inferSelect;
export type NewDevelopmentEntry = typeof developmentEntries.$inferInsert;
export type DevelopmentGoal = typeof developmentGoals.$inferSelect;
