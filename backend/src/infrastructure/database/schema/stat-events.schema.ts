import { doublePrecision, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { games } from './games.schema.js';

export const statTypeEnum = pgEnum('stat_type', [
  '2PM', '2PA', '3PM', '3PA', 'FTM', 'FTA',
  'OREB', 'DREB',
  'AST', 'TO',
  'STL', 'BLK', 'DFD',
  'PF', 'TF', 'FF',
  'SUB_IN', 'SUB_OUT',
  'PERIOD_START', 'PERIOD_END',
  'TIMEOUT',
]);

export const statEvents = pgTable('stat_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  period: integer('period').notNull(),
  clockTimeSeconds: integer('clock_time_seconds'),
  playerId: uuid('player_id'),
  teamId: uuid('team_id'),
  statType: statTypeEnum('stat_type').notNull(),
  value: integer('value').default(1).notNull(),
  xCourt: real('x_court'),
  yCourt: real('y_court'),
  lineupSnapshotId: uuid('lineup_snapshot_id'),
  seq: doublePrecision('seq'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const statEventAudits = pgTable('stat_event_audits', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull(),
  editorUserId: uuid('editor_user_id').notNull(),
  originalValue: jsonb('original_value').notNull(),
  newValue: jsonb('new_value').notNull(),
  editedAt: timestamp('edited_at', { withTimezone: true }).defaultNow().notNull(),
});

export const shotZoneEnum = pgEnum('shot_zone', [
  'restricted_area',
  'paint',
  'mid_range_left',
  'mid_range_center',
  'mid_range_right',
  'left_corner_3',
  'left_wing_3',
  'top_arc_3',
  'right_wing_3',
  'right_corner_3',
  'backcourt',
]);

export type StatEvent = typeof statEvents.$inferSelect;
export type NewStatEvent = typeof statEvents.$inferInsert;
export type StatType = (typeof statTypeEnum.enumValues)[number];
