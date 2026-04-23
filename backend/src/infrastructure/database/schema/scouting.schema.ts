import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.schema.js';

export const scoutingRecommendationEnum = pgEnum('scouting_recommendation', [
  'sign',
  'monitor',
  'pass',
  'no_action',
]);

export const reportVisibilityEnum = pgEnum('report_visibility', [
  'private',
  'team',
  'link',
]);

export const scoutingReports = pgTable('scouting_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorUserId: uuid('author_user_id').notNull().references(() => users.id),
  subjectPlayerId: uuid('subject_player_id'),
  subjectTeamId: uuid('subject_team_id'),
  gameId: uuid('game_id'),
  reportDate: timestamp('report_date', { withTimezone: true }).notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  strengths: text('strengths'),
  weaknesses: text('weaknesses'),
  recommendation: scoutingRecommendationEnum('recommendation'),
  overallRating: integer('overall_rating'),
  skillRatings: jsonb('skill_ratings'),
  videoLinks: text('video_links').array(),
  attachments: text('attachments').array(),
  visibility: reportVisibilityEnum('visibility').default('private').notNull(),
  shareToken: text('share_token').unique(),
  tags: text('tags').array(),
  isOpponentReport: boolean('is_opponent_report').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type ScoutingReport = typeof scoutingReports.$inferSelect;
export type NewScoutingReport = typeof scoutingReports.$inferInsert;
